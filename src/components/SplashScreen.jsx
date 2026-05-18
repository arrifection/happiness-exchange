import BrandLogo from './BrandLogo.jsx'

export default function SplashScreen({ visible }) {
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-content bg-[#FAF8F0] transition-all duration-700 ${
        visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <BrandLogo size="lg" showText={true} animated={visible} />
    </div>
  )
}
