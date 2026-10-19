// ชุดไอคอนแบบ line-icon อย่างง่าย ใช้ซ้ำได้ทั่วทั้งแอป (ไม่พึ่งพา icon library ภายนอก)
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

function Svg({ children, size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      {children}
    </svg>
  );
}

export const HomeIcon = (p) => <Svg {...p}><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></Svg>;

export const BookStackIcon = (p) => <Svg {...p}><path d="M5 4.5h9a2 2 0 0 1 2 2V19H7a2 2 0 0 1-2-2V4.5Z" /><path d="M16 8h3v11h-9" /></Svg>;

export const HistoryIcon = (p) => <Svg {...p}><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M4 4v4h4" /><path d="M12 8v4l3 2" /></Svg>;

export const UserIcon = (p) => <Svg {...p}><circle cx="12" cy="8" r="3.4" /><path d="M5 20c1-3.6 4-5.5 7-5.5s6 1.9 7 5.5" /></Svg>;

export const SearchIcon = (p) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.3-4.3" /></Svg>;

export const ChevronLeftIcon = (p) => <Svg {...p}><path d="m14.5 5-7 7 7 7" /></Svg>;

export const ChevronRightIcon = (p) => <Svg {...p}><path d="m9.5 5 7 7-7 7" /></Svg>;

export const CheckCircleIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.6 2.6L16.3 9" /></Svg>;

export const AlertIcon = (p) => <Svg {...p}><path d="M12 4 3 20h18L12 4Z" /><path d="M12 10.5v4" /><path d="M12 17.2v.1" /></Svg>;

export const EditIcon = (p) => <Svg {...p}><path d="M16.5 4.5 19.5 7.5 8 19H5v-3L16.5 4.5Z" /></Svg>;

export const LogoutIcon = (p) => <Svg {...p}><path d="M9 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4" /><path d="M15 16l4-4-4-4" /><path d="M19 12H9" /></Svg>;

export const EyeIcon = (p) => <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></Svg>;

export const EyeOffIcon = (p) => <Svg {...p}><path d="M3 3l18 18" /><path d="M10.6 5.6A10.6 10.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15 15 0 0 1-3 3.7M6.5 6.9C4 8.6 2.5 12 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 3.9-.85" /><path d="M9.9 10a2.8 2.8 0 0 0 4 4" /></Svg>;

export const MenuIcon = (p) => <Svg {...p}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></Svg>;

export const GlobeIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" /></Svg>;

export const FileTextIcon = (p) => <Svg {...p}><path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M14 3.5V8h4" /><path d="M9 12.5h6M9 16h6" /></Svg>;

export const PackageIcon = (p) => <Svg {...p}><path d="M12 3.5 20.5 8 12 12.5 3.5 8 12 3.5Z" /><path d="M3.5 8v8.5L12 21l8.5-4.5V8" /><path d="M12 12.5V21" /></Svg>;

export const UsersIcon = (p) => <Svg {...p}><circle cx="9" cy="8" r="3" /><path d="M3 19c.8-3 3-4.6 6-4.6s5.2 1.6 6 4.6" /><path d="M16 4.8a3 3 0 0 1 0 5.9" /><path d="M19 19c-.5-2-1.6-3.4-3-4.2" /></Svg>;

export const RepeatIcon = (p) => <Svg {...p}><path d="M4 9.5a5.5 5.5 0 0 1 9.4-3.9L16 8" /><path d="M16 4v4h-4" /><path d="M20 14.5A5.5 5.5 0 0 1 10.6 18.4L8 16" /><path d="M8 20v-4h4" /></Svg>;

export const PlusIcon = (p) => <Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>;

export const CameraIcon = (p) => <Svg {...p}><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.3" /></Svg>;

export const TruckIcon = (p) => <Svg {...p}><path d="M2.5 6.5h11v9h-11z" /><path d="M13.5 10h3.5l3 3v2.5h-6.5z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></Svg>;

export const StarIcon = (p) => <Svg {...p}><path d="m12 3.5 2.5 5.4 5.9.6-4.4 4 1.2 5.9L12 16.4l-5.2 3 1.2-5.9-4.4-4 5.9-.6L12 3.5Z" /></Svg>;
export const TrashIcon = (p) => <Svg {...p}><path d="M4.5 7h15" /><path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" /><path d="M6.5 7 7.3 19a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7" /><path d="M10 11v5M14 11v5" /></Svg>;

export const SparkleIcon = (p) => <Svg {...p}><path d="M11 3.5c.5 2.7 1.1 4.2 2 5.5 1.3.9 2.8 1.5 5.5 2-2.7.5-4.2 1.1-5.5 2-.9 1.3-1.5 2.8-2 5.5-.5-2.7-1.1-4.2-2-5.5-1.3-.9-2.8-1.5-5.5-2 2.7-.5 4.2-1.1 5.5-2 .9-1.3 1.5-2.8 2-5.5Z" /><path d="M19 3.2c.2 1 .5 1.6.9 2 .4.4 1 .7 2 .9-1 .2-1.6.5-2 .9-.4.4-.7 1-.9 2-.2-1-.5-1.6-.9-2-.4-.4-1-.7-2-.9 1-.2 1.6-.5 2-.9.4-.4.7-1 .9-2Z" /></Svg>;

export const GridIcon = (p) => <Svg {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></Svg>;

export const CloseIcon = (p) => <Svg {...p}><path d="M5.5 5.5 18.5 18.5" /><path d="M18.5 5.5 5.5 18.5" /></Svg>;

export const ChevronDownIcon = (p) => <Svg {...p}><path d="m5 9 7 7 7-7" /></Svg>;

export const CheckIcon = (p) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>;

export const SunIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></Svg>;

export const MoonIcon = (p) => <Svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></Svg>;

export const HeartIcon = (p) => <Svg {...p}><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" /></Svg>;

export const BellIcon = (p) => <Svg {...p}><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15L6 16.5Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></Svg>;

export const FilterIcon = (p) => <Svg {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Svg>;
