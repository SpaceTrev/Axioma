export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Axioma</h1>
      <p>Crypto Prediction Market</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Features</h2>
        <ul>
          <li>Create and trade prediction markets</li>
          <li>Real-time order matching engine</li>
          <li>Decentralized settlement system</li>
          <li>Built with Next.js, Fastify, and Prisma</li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Get Started</h2>
        <p>
          API is running at:{' '}
          <a href={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}>
            {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
          </a>
        </p>
      </div>
    </main>
  );
}
