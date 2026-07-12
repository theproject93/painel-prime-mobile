import { useState } from 'react';

import logoUrl from '../../mobile/assets/splash-icon.png';

type ScreenKey = 'inicio' | 'eventos' | 'clientes' | 'caixa' | 'fornecedores' | 'mais';

const screens: Array<{ key: ScreenKey; label: string; icon: string }> = [
  { key: 'inicio', label: 'Início', icon: '⌂' },
  { key: 'eventos', label: 'Eventos', icon: '◫' },
  { key: 'clientes', label: 'Clientes', icon: '♙' },
  { key: 'caixa', label: 'Meu caixa', icon: '◈' },
  { key: 'fornecedores', label: 'Fornec.', icon: '⌂' },
  { key: 'mais', label: 'Mais', icon: '▦' },
];

const screenContent: Record<ScreenKey, { eyebrow: string; title: string; subtitle: string }> = {
  inicio: {
    eyebrow: 'OPERAÇÃO CENTRAL',
    title: 'Bom trabalho, assessora',
    subtitle: 'O que merece sua atenção hoje.',
  },
  eventos: {
    eyebrow: 'SEUS EVENTOS',
    title: 'Eventos',
    subtitle: 'Acesse rapidamente cada celebração.',
  },
  clientes: {
    eyebrow: 'JORNADA COMERCIAL',
    title: 'Clientes',
    subtitle: 'Do primeiro contato à assinatura.',
  },
  caixa: {
    eyebrow: 'FINANÇAS DA ASSESSORIA',
    title: 'Meu caixa',
    subtitle: 'Entradas e despesas da sua assessoria.',
  },
  fornecedores: {
    eyebrow: 'REDE DE PARCEIROS',
    title: 'Fornecedores',
    subtitle: 'Seus parceiros organizados por categoria.',
  },
  mais: {
    eyebrow: 'SUA CONTA',
    title: 'Mais',
    subtitle: 'Perfil, segurança e preferências.',
  },
};

function JourneyCard({ step, title, copy, tone = 'gold' }: { step: string; title: string; copy: string; tone?: 'gold' | 'green' | 'ink' }) {
  return (
    <article className={`journey-card journey-card--${tone}`}>
      <span>{step}</span>
      <div>
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
      <b aria-hidden>›</b>
    </article>
  );
}

function ScreenBody({ active }: { active: ScreenKey }) {
  if (active === 'clientes') {
    return (
      <section className="stack">
        <div className="section-heading"><h2>Próximos passos</h2><button>Novo contato</button></div>
        <JourneyCard step="01" title="Preparar orçamento" copy="Envie uma proposta elegante pelo Papermark." />
        <JourneyCard step="02" title="Acompanhar cliente" copy="Veja quem abriu ou aprovou a proposta." tone="ink" />
        <JourneyCard step="03" title="Assinar contrato" copy="Conclua a contratação pelo Documenso." tone="green" />
      </section>
    );
  }

  if (active === 'caixa') {
    return (
      <section className="stack">
        <div className="balance-card">
          <small>SALDO DA SUA ASSESSORIA</small>
          <strong>R$ 0,00</strong>
          <div><span>Entradas<br /><b>R$ 0,00</b></span><span>Despesas<br /><b>R$ 0,00</b></span></div>
        </div>
        <button className="primary-button">＋ Novo lançamento</button>
        <div className="empty-card"><div className="empty-icon">◔</div><h2>Seu caixa começa aqui</h2><p>Registre uma entrada ou despesa para visualizar a distribuição.</p></div>
      </section>
    );
  }

  if (active === 'eventos') {
    return (
      <section className="stack">
        <div className="section-heading"><h2>Em andamento</h2><button>Novo evento</button></div>
        <JourneyCard step="15 JUN" title="Casamento Hellen & Hélio" copy="Resumo · Tarefas · Reuniões · Fornecedores" tone="ink" />
        <JourneyCard step="22 AGO" title="Celebração corporativa" copy="Tudo organizado para o próximo passo." />
      </section>
    );
  }

  if (active === 'fornecedores') {
    return (
      <section className="stack">
        <div className="section-heading"><h2>Categorias</h2><button>Novo parceiro</button></div>
        <div className="chips"><span>Todos</span><span>Buffet</span><span>Fotografia</span><span>Espaço</span></div>
        <div className="empty-card"><div className="empty-icon">⌂</div><h2>Sua rede de confiança</h2><p>Cadastre parceiros para reutilizá-los em seus eventos.</p></div>
      </section>
    );
  }

  if (active === 'mais') {
    return (
      <section className="stack">
        <div className="identity-card"><img src={logoUrl} alt="" /><div><strong>Painel Prime</strong><span>Conta conectada</span></div></div>
        <JourneyCard step="♙" title="Perfil" copy="Dados pessoais, contatos e assinatura" tone="ink" />
        <JourneyCard step="⚙" title="Configurações" copy="Biometria, privacidade e versão do app" />
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="hero-card">
        <div><small>PIPELINE COMERCIAL</small><strong>13</strong><span>clientes em acompanhamento</span></div>
        <div className="hero-stat"><b>4</b><span>eventos ativos</span></div>
      </div>
      <div className="section-heading"><h2>Prioridades de hoje</h2><button>Ver todas</button></div>
      <JourneyCard step="1" title="Revisar proposta" copy="Um cliente aguarda seu orçamento." />
      <JourneyCard step="2" title="Confirmar fornecedor" copy="Finalize os detalhes do próximo evento." tone="green" />
    </section>
  );
}

export default function App() {
  const [active, setActive] = useState<ScreenKey>('inicio');
  const content = screenContent[active];

  return (
    <main className="studio-page">
      <aside className="context-panel">
        <div className="brand"><img src={logoUrl} alt="Painel Prime" /><div><strong>Painel Prime</strong><span>Android 1.0</span></div></div>
        <div className="context-copy">
          <span className="preview-pill">COMPANION PREVIEW</span>
          <h1>Uma prévia fiel do aplicativo Android.</h1>
          <p>Este ambiente existe para o Google AI Studio visualizar o produto. O código de produção continua em <code>apps/mobile</code>.</p>
        </div>
        <ul>
          <li>Sem dados falsos ou credenciais</li>
          <li>Sem dependência do repositório WEB</li>
          <li>Sem impacto no APK ou no Expo</li>
        </ul>
      </aside>

      <section className="device-stage">
        <div className="device">
          <div className="status-bar"><span>9:41</span><span>● 5G ▰</span></div>
          <div className="app-content">
            <header><span>{content.eyebrow}</span><h1>{content.title}</h1><p>{content.subtitle}</p></header>
            <ScreenBody active={active} />
          </div>
          <nav aria-label="Navegação principal">
            {screens.map((item) => (
              <button key={item.key} className={active === item.key ? 'active' : ''} onClick={() => setActive(item.key)}>
                <i>{item.icon}</i><span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}
