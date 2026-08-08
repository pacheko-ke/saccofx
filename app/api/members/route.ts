    import { neon } from '@neondatabase/serverless';
export async function POST(request: Request) {
  try {
    const data = await request.json();

    

        // Connect to the Neon database
        const sql = neon(`${process.env.DATABASE_URL}`);

        // Insert the comment from the form into the Postgres database
        await sql.query('SELECT * FROM members')
     
    
    return new Response(JSON.stringify({ message: "Members", member: data }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ message: "Error creating member" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }}