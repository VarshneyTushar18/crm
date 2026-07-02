import { BRAND_LOGO, BRAND_NAME, BRAND_LOGO_SIZES } from "@/config/brandConfig";
import "./brandLogo.css";

export default function BrandLogo({
  variant = "sidebar",
  src,
  alt = BRAND_NAME,
  className = "",
  style,
  onClick,
}) {
  const size = BRAND_LOGO_SIZES[variant] || BRAND_LOGO_SIZES.sidebar;

  return (
    <img
      src={src || BRAND_LOGO}
      alt={alt}
      className={`brand-logo brand-logo--${variant} ${className}`.trim()}
      onClick={onClick}
      style={{
        height: size.height,
        maxWidth: size.maxWidth,
        width: "auto",
        objectFit: "contain",
        display: "block",
        ...style,
      }}
    />
  );
}
