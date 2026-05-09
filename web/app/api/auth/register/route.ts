import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import sql from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  restaurantName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const existing = await sql("SELECT id FROM users WHERE email = $1", [data.email]);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }

    const passwordHash = await hash(data.password, 12);

    const [restaurant] = await sql(
      "INSERT INTO restaurants (nombre) VALUES ($1) RETURNING id",
      [data.restaurantName]
    );

    await sql(
      `INSERT INTO users (name, email, password_hash, restaurant_id, role)
       VALUES ($1, $2, $3, $4, 'owner')`,
      [data.name, data.email, passwordHash, restaurant.id]
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
