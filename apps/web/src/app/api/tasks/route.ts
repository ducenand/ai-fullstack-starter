import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({ prompt: z.string().min(1).max(2000) });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tasks = await prisma.aiTask.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return Response.json({ tasks });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 });

  const task = await prisma.aiTask.create({
    data: { userId: session.user.id, prompt: parsed.data.prompt },
  });
  return Response.json({ task }, { status: 201 });
}
