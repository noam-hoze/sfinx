import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from 'app/shared/services/server';
import { INITIAL_IDENTITIES } from 'app/nhi-dashboard/data/mockData';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string })?.role;
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentKey = process.env.OPENAI_API_KEY || '';
    const last4 = currentKey.length >= 4 ? currentKey.slice(-4) : 'BToA';

    const updatedIdentities = INITIAL_IDENTITIES.map((item) =>
      item.provider === 'OpenAI'
        ? {
            ...item,
            name: `openai-evaluator-api-key (sk-...${last4})`
          }
        : item
    );

    return NextResponse.json({ identities: updatedIdentities });
  } catch {
    return NextResponse.json({ identities: INITIAL_IDENTITIES });
  }
}
