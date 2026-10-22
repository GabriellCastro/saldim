'use client';
import { usePathname } from 'next/navigation';
import { BrandMark } from '@/components/ui/BrandMark';
import { AUTH_ROUTES } from '@/lib/routes';
import styles from './auth.module.css';

/**
 * Moldura das telas de acesso.
 * Desktop: painel da marca à esquerda + formulário à direita.
 * Mobile: logo no topo, frase de destaque (só no login) e o conteúdo num painel de vidro até o fim da tela.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const isLogin = usePathname() === AUTH_ROUTES.login;
  return (
    <div className={`${styles.shell} ${isLogin ? styles.shellLogin : ''}`}>
      <aside className={styles.aside}>
        <BrandMark />
        <div className={styles.hero}>
          <div className={styles.eyebrow}>Controle financeiro com IA</div>
          <h1 className={styles.heroTitle}>Teu holerite e teu extrato, lidos pela IA.</h1>
          <p className={styles.heroText}>
            Envia os documentos ou conecta o banco. A IA separa os gastos, projeta tua reserva e monta um plano mês a mês.
          </p>
        </div>
        <div className={styles.secure}>
          <span className={styles.dotPos} />
          Dados criptografados · Open Finance regulado pelo Banco Central
        </div>
      </aside>

      <div className={styles.mobileBrand}>
        <BrandMark small />
        <span className={styles.secureChip}>
          <span className={styles.dotPos} />
          Criptografado
        </span>
      </div>
      {isLogin && (
        <div className={styles.mobileHero}>
          <div className={styles.eyebrow}>Controle financeiro com IA</div>
          <p className={styles.mobileHeroTitle}>
            Teu holerite e teu extrato, <em>lidos pela IA.</em>
          </p>
          <p className={styles.mobileHeroText}>A IA separa os gastos, projeta tua reserva e monta um plano mês a mês.</p>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.column}>{children}</div>
      </main>
    </div>
  );
}
