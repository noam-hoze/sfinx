import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
    const jds = await prisma.jD.findMany({ include: { tasks: true } });
    return NextResponse.json({ count: jds.length, jds });
}
