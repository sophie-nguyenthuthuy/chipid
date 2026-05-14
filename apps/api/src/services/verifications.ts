import type { Prisma, Verification } from '@prisma/client';
import { verifyChipDump } from '@chipid/nfc-parser';
import { prisma } from '../db/client.js';
import { id } from '../lib/ids.js';
import { lookupHash } from '../lib/crypto.js';
import { ApiError } from '../lib/errors.js';
import { logger } from '../logger.js';
import { enqueueEvent } from './events.js';
import type { VerificationCreateBody, VerificationSubmitBody, VerificationResource } from '../schemas/verification.js';

const CLIENT_SECRET_TTL_MS = 1000 * 60 * 30; // 30 minutes

export async function createVerification(
  args: {
    accountId: string;
    environment: 'test' | 'live';
    body: VerificationCreateBody;
  },
): Promise<{ resource: VerificationResource; clientSecret: string }> {
  const clientSecret = id.clientSecret(args.environment);

  const row = await prisma.verification.create({
    data: {
      accountId: args.accountId,
      environment: args.environment,
      type: args.body.type,
      clientSecretHash: lookupHash(clientSecret, 'client_secret'),
      clientSecretExpiresAt: new Date(Date.now() + CLIENT_SECRET_TTL_MS),
      ...(args.body.return_url !== undefined ? { returnUrl: args.body.return_url } : {}),
      metadata: args.body.metadata,
    },
  });

  await enqueueEvent({
    accountId: args.accountId,
    verificationId: row.id,
    type: 'verification.created',
    data: toResource(row, clientSecret),
  });

  return { resource: toResource(row, clientSecret), clientSecret };
}

export async function getVerification(args: {
  accountId: string;
  id: string;
}): Promise<VerificationResource> {
  const row = await prisma.verification.findFirst({
    where: { id: args.id, accountId: args.accountId },
  });
  if (!row) throw new ApiError('resource_missing', `No such verification: ${args.id}`);
  return toResource(row, null);
}

export async function listVerifications(args: {
  accountId: string;
  limit: number;
  startingAfter?: string;
}): Promise<{ data: VerificationResource[]; has_more: boolean }> {
  const cursor: Prisma.VerificationWhereUniqueInput | undefined = args.startingAfter
    ? { id: args.startingAfter }
    : undefined;

  const rows = await prisma.verification.findMany({
    where: { accountId: args.accountId },
    orderBy: { createdAt: 'desc' },
    take: args.limit + 1,
    ...(cursor ? { cursor, skip: 1 } : {}),
  });

  const has_more = rows.length > args.limit;
  return {
    data: rows.slice(0, args.limit).map((r) => toResource(r, null)),
    has_more,
  };
}

/**
 * Submitted from the mobile client. We authenticate by `client_secret`
 * (not by API key), then run Passive Authentication against the chip's SOD
 * and the configured CSCA trust anchor.
 */
export async function submitVerification(
  body: VerificationSubmitBody,
): Promise<VerificationResource> {
  const hash = lookupHash(body.client_secret, 'client_secret');
  const row = await prisma.verification.findUnique({ where: { clientSecretHash: hash } });
  if (!row) throw new ApiError('client_secret_invalid', 'Invalid client_secret.');
  if (row.clientSecretExpiresAt < new Date()) {
    throw new ApiError('client_secret_expired', 'The client_secret has expired.');
  }
  if (row.status !== 'requires_input') {
    throw new ApiError(
      'verification_failed',
      `Verification is already in status ${row.status}.`,
    );
  }

  await prisma.verification.update({
    where: { id: row.id },
    data: { status: 'processing' },
  });

  try {
    const result = await verifyChipDump({
      sod: Buffer.from(body.sod, 'base64'),
      dataGroups: Object.fromEntries(
        Object.entries(body.data_groups).map(([k, v]) => [Number(k), Buffer.from(v, 'base64')]),
      ),
      ...(body.active_auth_response
        ? { activeAuthResponse: Buffer.from(body.active_auth_response, 'base64') }
        : {}),
    });

    if (!result.ok) {
      const failed = await prisma.verification.update({
        where: { id: row.id },
        data: {
          status: 'failed',
          failureCode: result.failureCode,
          failureMessage: result.message,
        },
      });
      await enqueueEvent({
        accountId: row.accountId,
        verificationId: row.id,
        type: 'verification.failed',
        data: toResource(failed, null),
      });
      return toResource(failed, null);
    }

    const verified = await prisma.verification.update({
      where: { id: row.id },
      data: {
        status: 'verified',
        verifiedAt: new Date(),
        fullName: result.subject.fullName,
        dateOfBirth: result.subject.dateOfBirth,
        sex: result.subject.sex,
        nationality: result.subject.nationality,
        idNumber: result.subject.idNumber,
        idExpiresAt: result.subject.idExpiresAt,
      },
    });
    await prisma.usageRecord.create({
      data: { accountId: row.accountId, verificationId: row.id },
    });
    await enqueueEvent({
      accountId: row.accountId,
      verificationId: row.id,
      type: 'verification.verified',
      data: toResource(verified, null),
    });
    return toResource(verified, null);
  } catch (err) {
    logger.error({ err, verificationId: row.id }, 'verification submit failed');
    const failed = await prisma.verification.update({
      where: { id: row.id },
      data: {
        status: 'failed',
        failureCode: 'internal_error',
        failureMessage: 'Internal error during chip verification.',
      },
    });
    return toResource(failed, null);
  }
}

function toResource(row: Verification, clientSecret: string | null): VerificationResource {
  return {
    id: row.id,
    object: 'verification',
    type: row.type,
    status: row.status,
    client_secret: clientSecret,
    return_url: row.returnUrl,
    metadata: row.metadata as Record<string, string>,
    verified_outputs:
      row.status === 'verified' && row.fullName && row.dateOfBirth && row.sex && row.nationality && row.idNumber
        ? {
            full_name: row.fullName,
            date_of_birth: row.dateOfBirth.toISOString().slice(0, 10),
            sex: row.sex,
            nationality: row.nationality,
            id_number: row.idNumber,
            id_expires_at: row.idExpiresAt ? row.idExpiresAt.toISOString().slice(0, 10) : null,
            portrait_url: null, // populated by a presigned-URL minter; omitted here
          }
        : null,
    last_error: row.failureCode
      ? { code: row.failureCode, message: row.failureMessage ?? '' }
      : null,
    created: Math.floor(row.createdAt.getTime() / 1000),
    verified_at: row.verifiedAt ? Math.floor(row.verifiedAt.getTime() / 1000) : null,
  };
}
