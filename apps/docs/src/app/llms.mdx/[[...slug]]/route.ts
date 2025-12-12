import { getLLMText, source } from '@/lib/source';
import { notFound } from 'next/navigation';

export const revalidate = false;

export async function GET(
    _req: Request,
    { params }: { params: unknown },
) {
    const { slug } = (await Promise.resolve(params)) as { slug?: string[] };

    const page = source.getPage(slug);
    if (!page) notFound();

    return new Response(await getLLMText(page), {
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
        },
    });
}

export function generateStaticParams() {
    return source.generateParams();
}
