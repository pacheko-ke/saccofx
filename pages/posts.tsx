

export default async function Posts() {

const res = await fetch('http://localhost:3000/api/posts', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
const posts = await res.json();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Posts</h1>
      <p>Welcome to the Posts page!</p>
      <ul>
        {posts.map((post: any) => (
          <li key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.body}</p>
          </li>
        ))}
      </ul>

    </div>
  );
}
