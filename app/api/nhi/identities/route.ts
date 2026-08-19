import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from 'app/shared/services/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string })?.role;
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentKey = process.env.OPENAI_API_KEY || '';
    const last4 = currentKey.length >= 4 ? currentKey.slice(-4) : 'BToA';

    // 1. Query real PostgreSQL database table MachineIdentity
    const dbIdentities = await prisma.machineIdentity.findMany({
      orderBy: { createdAt: 'asc' }
    });

    // 2. Format OpenAI key display name with live key suffix
    const formattedIdentities = dbIdentities.map((item) => {
      const isOpenAI = item.provider === 'OpenAI';
      const keySuffixToUse = isOpenAI ? last4 : item.keySuffix;
      return {
        ...item,
        name: isOpenAI ? `openai-evaluator-api-key (sk-...${keySuffixToUse})` : item.name
      };
    });

    return NextResponse.json({ identities: formattedIdentities });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch identities from PostgreSQL' }, { status: 500 });
  }
}
