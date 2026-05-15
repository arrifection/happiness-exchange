import BrandLogo from './BrandLogo.jsx'

export default function SplashScreen({ visible }) {
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#fffaf0] px-6 transition-all duration-700 ${
        visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="relative flex flex-col items-center">
        <div className="brand-splash-square absolute -left-5 top-3 h-28 w-28 rounded-[2rem] bg-[#ffcc22]/30 blur-xl" />
        <div className="brand-splash-smile absolute left-1/2 top-10 h-20 w-36 -translate-x-[58%] rounded-b-[999px] border-b-[7px] border-[#8b4cf6]" />
        <div className="brand-splash-eye absolute left-[40%] top-8 h-3 w-3 rounded-full bg-[#8b4cf6]" />
        <div className="brand-splash-eye absolute left-[58%] top-8 h-3 w-3 rounded-full bg-[#8b4cf6]" />

        <div className="brand-splash-logo relative z-10">
          <BrandLogo size="lg" showText={false} />
        </div>

        <p className="brand-splash-title mt-6 text-center font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-bold tracking-tight text-[#1f1f1f] sm:text-4xl">
          Happiness Exchange
        </p>
      </div>
    </div>
  )
}
