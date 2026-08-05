import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  return new NextResponse(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
}


export async function POST(request: Request){
  const body = await request.json();
  const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
    method: 'POST',
    headers:{
      'Content-Type':'application/json'
    },
    body:JSON.stringify(body)
    });

  const data = await response.json();
  return new NextResponse(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
