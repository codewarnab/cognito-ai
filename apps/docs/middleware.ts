import { NextRequest, NextResponse } from 'next/server';
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';

const { rewrite: rewriteLLM } = rewritePath('/docs/*path', '/llms.mdx/*path');

export default function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Let the explicit `.mdx` URLs fall through to `next.config` rewrites.
    if (pathname.endsWith('.mdx')) {
        return NextResponse.next();
    }

    if (isMarkdownPreferred(request)) {
        const result = rewriteLLM(pathname);
        if (result) {
            return NextResponse.rewrite(new URL(result, request.nextUrl));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/docs/:path*'],
};
