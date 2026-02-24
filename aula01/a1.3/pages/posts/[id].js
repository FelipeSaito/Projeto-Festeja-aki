import { useRouter } from 'next/router';
import Link from 'next/link';

    export default function Post() {
        const router = useRouter();
        const { id } = router.query;

    return (
        <div>
            Id do post atual: {router.query.id}
        <h1>Post: {id}</h1>

        <ul>
            <li>
            <Link href="/">
                Ir para a Home
            </Link>
            </li>
        </ul>

        </div>
    );
}