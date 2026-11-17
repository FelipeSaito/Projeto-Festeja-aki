// pages/index.js
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import Header from "../components/Header";
import styles from "../styles/Home.module.css";

// Endereço público do site e imagem usada na prévia do link (WhatsApp, redes sociais).
// A prévia exige endereços completos, com https://.
// Para trocar a imagem: salve a nova em public/ e altere só IMAGEM_PREVIA.
const SITE_URL = "https://projeto-festeja-aki.vercel.app";
const IMAGEM_PREVIA = `${SITE_URL}/icons/logo.jpg`;

const TITULO = "Festeja Aki | Salão de festas";
const DESCRICAO =
  "Salão de festas com playground, churrasqueira, som ambiente e iluminação. Veja as datas livres e reserve o seu fim de semana.";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>{TITULO}</title>
        <meta name="description" content={DESCRICAO} />

        {/* Prévia do link no WhatsApp e em redes sociais */}
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:site_name" content="Festeja Aki" />
        <meta property="og:title" content={TITULO} />
        <meta property="og:description" content={DESCRICAO} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={IMAGEM_PREVIA} />
        <meta property="og:image:alt" content="Festeja Aki" />
        <meta name="twitter:card" content="summary" />
      </Head>

      <Header />

      <section className={styles.hero}>
        <Image
          src="/images/background.png"
          alt="Festeja Aki"
          fill
          priority
          className={styles.bg}
        />

        <div className={styles.overlay} />

        <div className={styles.content}>
          <h1 className={styles.title}>
            <span className={styles.wordCycle} aria-label="Transforme, Celebre, Viva">
              <span>TRANSFORME</span>
              <span>REALIZEM</span>
              <span>APROVEITEM</span>
            </span>{" "}
            MOMENTOS ESPECIAIS
            <br />
            EM MEMÓRIAS INESQUECÍVEIS.
          </h1>

          <Link href="/calendario" className={styles.btn}>
            Reservar agora
          </Link>
        </div>
      </section>

<section id="sobre" className={styles.aboutSpace}>
  <h2 className={styles.aboutTitle}>Sobre o Espaço</h2>

  <div className={styles.aboutLayout}>
    {/* TOP LEFT */}
    <div className={`${styles.feature} ${styles.tl}`}>
      <div className={styles.featureIcon}>
        <Image src="/Icon/Audio.svg" alt="" width={41} height={41} className={styles.iconImg} />
      </div>
      <h3>Som ambiente em todo o espaço</h3>
      <p>
        Disponibilizamos 3 caixas de som estrategicamente posicionadas, conectadas ao celular do cliente via Bluetooth,
        garantindo liberdade total para escolher e controlar as músicas da festa.
      </p>
    </div>

    {/* TOP CENTER IMAGE */}
    <div className={`${styles.photoWrap} ${styles.tc}`}>
      <div className={styles.cornerFrame}>
        <Image src="/images/som.svg" alt="Som" width={266} height={355} className={styles.photo} />
      </div>
    </div>

    {/* TOP RIGHT */}
    <div className={`${styles.feature} ${styles.tr}`}>
      <div className={styles.featureIcon}>
        <Image src="/Icon/iluminacao.svg" alt="" width={41} height={41} className={styles.iconImg} />
      </div>
      <h3>Efeito discoteca para animar sua festa</h3>
      <p>
        Disponibilizamos iluminação colorida especial que cria um clima vibrante e divertido,
        perfeito para momentos de dança e celebração.
      </p>
    </div>

    {/* MID LEFT IMAGE */}
    <div className={`${styles.photoWrap} ${styles.ml}`}>
      <div className={styles.cornerFrame}>
        <Image src="/images/churrasco.svg" alt="Churrasco" width={266} height={355} className={styles.photo} />
      </div>
    </div>

    {/* MID CENTER */}
    <div className={`${styles.feature} ${styles.mc}`}>
      <div className={styles.featureIcon}>
        <Image src="/Icon/churrasco.svg" alt="icone churrasco" width={41} height={41} className={styles.iconImg} />
      </div>
      <h3>Espaço exclusivo para churrasco</h3>
      <p>
        Disponibilizamos área preparada para churrasco, ideal para tornar sua festa ainda mais completa e saborosa.
      </p>
    </div>

    {/* MID RIGHT IMAGE */}
    <div className={`${styles.photoWrap} ${styles.mr}`}>
      <div className={styles.cornerFrame}>
        <Image src="/images/imgplayground.svg" alt="Playground" width={266} height={355} className={styles.photo} />
      </div>
    </div>

    {/* BOT LEFT IMAGE */}
    <div className={`${styles.photoWrap} ${styles.bl}`}>
      <div className={styles.cornerFrame}>
        <Image src="/images/festejaaki.svg" alt="Fachada" width={266} height={355} className={styles.photo} />
      </div>
    </div>

    {/* BOT CENTER */}
    <div className={`${styles.feature} ${styles.bc}`}>
      <div className={styles.featureIcon}>
        <Image src="/Icon/localizacao.svg" alt="" width={41} height={41} className={styles.iconImg} />
      </div>
      <h3>Localização</h3>
      <p>
        Nosso espaço fica na Rua Koto Mitsutani, nº 422 – CEP 05791-001, em um local de fácil acesso para tornar sua
        festa ainda mais prática e especial.
      </p>
    </div>

    {/* BOT RIGHT */}
    <div className={`${styles.feature} ${styles.br}`}>
      <div className={styles.featureIcon}>
        <Image src="/Icon/pac-man.svg" alt="" width={41} height={41} className={styles.iconImg} />
      </div>
      <h3>Diversão garantida para todas as idades</h3>
      <p>
        O Festeja Aki oferece playground, piscina de bolinhas, pula-pula, tobogã, fliperama, pebolim e sinuca,
        proporcionando diversão completa para crianças e também para os adultos.
      </p>
    </div>
  </div>
</section>

<footer className={styles.footer}>
  <div className={styles.footerContainer}>

    <div className={styles.footerBrand}>
      <h3>Festeja Aki</h3>
      <p>
        🎉 O espaço ideal para sua próxima comemoração.
      </p>
    </div>

    <div className={styles.footerLinks}>
      <h4>Links rápidos</h4>
      <a href="#sobre">Sobre nós</a>
      <a href="https://www.google.com/maps/place/Sal%C3%A3o+Festeja-Aki/@-23.6477927,-46.7845667,3a,75y,301.88h,80.92t/data=!3m7!1e1!3m5!1sN54ATbzOl38J9XDHmd5FCA!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D9.07535563963556%26panoid%3DN54ATbzOl38J9XDHmd5FCA%26yaw%3D301.8842270650802!7i16384!8i8192!4m6!3m5!1s0x94ce53af460def3b:0x4d0a85237616a0af!8m2!3d-23.6477419!4d-46.7847162!16s%2Fg%2F11p74llryg?entry=ttu&g_ep=EgoyMDI2MDIyMy4wIKXMDSoASAFQAw%3D%3D">Localização</a>
      <a href="/calendario">Reservar</a>
    </div>

    <div className={styles.footerContact}>
      <h4>Contato</h4>
      <p>📍 Rua Koto Mitsutani, 422</p>
      <p>📞 (11) 95840-3673</p>
      <p>✉️ marciosaito@gmail.com</p>
    </div>

  </div>

  <div className={styles.footerBottom}>
    © {new Date().getFullYear()} Festeja Aki. Todos os direitos reservados.
  </div>
</footer>

    </>
  );
}