import Link from 'next/link';
import { ArrowRight, Database, ShieldCheck } from 'lucide-react';

type AdminQuickActionsProps = {
  locale?: 'EN' | 'AR';
  compact?: boolean;
  showPanelLink?: boolean;
  showDatabaseLink?: boolean;
  className?: string;
};

const copy = {
  EN: {
    badge: 'Admins only',
    title: 'Admin control center',
    description: 'Database and system tools are visible here automatically for admins, so nobody needs to type a hidden URL by hand.',
    panelButton: 'Open admin panel',
    databaseButton: 'Open database'
  },
  AR: {
    badge: 'للأدمن فقط',
    title: 'لوحة تحكم الأدمن',
    description: 'أدوات النظام وقاعدة البيانات ظاهرة هنا تلقائيًا للأدمن بدون كتابة الرابط يدويًا في الشريط.',
    panelButton: 'فتح لوحة الأدمن',
    databaseButton: 'فتح قاعدة البيانات'
  }
} as const;

export function AdminQuickActions({
  locale = 'EN',
  compact = false,
  showPanelLink = true,
  showDatabaseLink = true,
  className = ''
}: AdminQuickActionsProps) {
  const t = copy[locale];

  return (
    <section className={`rounded-[2rem] border border-white/25 bg-white/12 backdrop-blur-xl text-white shadow-2xl ${compact ? 'p-5' : 'p-6 md:p-7'} ${className}`.trim()}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-white/80">
            <ShieldCheck className="h-4 w-4" />
            {t.badge}
          </div>
          <h3 className={`mt-3 font-black ${compact ? 'text-2xl' : 'text-2xl md:text-3xl'}`}>{t.title}</h3>
          <p className="mt-3 text-sm leading-6 text-white/80">{t.description}</p>
        </div>

        <div className="flex flex-wrap gap-3 md:justify-end">
          {showPanelLink ? (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-[#014CB3] px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#013f98]"
            >
              <ShieldCheck className="h-4 w-4" />
              {t.panelButton}
            </Link>
          ) : null}

          {showDatabaseLink ? (
            <Link
              href="/admin/db"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-[#60C10F] px-5 py-3 text-sm font-black text-[#04265a] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#72d71d]"
            >
              <Database className="h-4 w-4" />
              {t.databaseButton}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
