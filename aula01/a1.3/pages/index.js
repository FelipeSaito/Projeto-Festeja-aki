import Link from 'next/link'


function HomePage () {
  return (
    <div>
      BEM-VINDO
      <img src="/images/background.png" alt="Background" />
      <ul>
        <li>
          <Link href="/sobre">
            Ir para a Sobre nós
          </Link>
        </li>
      </ul>

    </div>
  )
}

export default HomePage