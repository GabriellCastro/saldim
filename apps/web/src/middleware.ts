import { NextResponse, type NextRequest } from 'next/server';

/**
 * Guarda de sessão por presença do cookie `saldim_token` (setado pela API em localhost:3333;
 * cookies não distinguem porta, então o web enxerga). A validade real do JWT é checada pela API:
 * se expirar, /auth/me responde 401 e o app volta para /login.
 */
const PUBLIC = ['/login', '/registro', '/facial'];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasToken = req.cookies.has('saldim_token');
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasToken && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  // Logado não precisa ver o login. /registro e /facial seguem abertos: o cadastro continua
  // depois da conta criada (cookie já existe) e /facial?modo=recadastrar vem do perfil.
  if (hasToken && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/visao-geral';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // tudo exceto assets do Next, fontes e arquivos com extensão
  matcher: ['/((?!_next/|fonts/|api/|.*\\.[\\w]+$).*)'],
};
