import React from "react";
import { SiGmail, SiYoutube, SiTiktok, SiInstagram, SiX, SiFacebook, SiTwitch, SiThreads, SiPinterest, SiSnapchat } from "react-icons/si";
import { FaLinkedin } from "react-icons/fa";
import { IconType } from "react-icons";

const ICONS: Record<string, { Icon: IconType; color: string }> = {
  gmail: { Icon: SiGmail, color: "#EA4335" },
  youtube: { Icon: SiYoutube, color: "#FF0000" },
  tiktok: { Icon: SiTiktok, color: "#ffffff" },
  instagram: { Icon: SiInstagram, color: "#E4405F" },
  twitter: { Icon: SiX, color: "#ffffff" },
  x: { Icon: SiX, color: "#ffffff" },
  threads: { Icon: SiThreads, color: "#ffffff" },
  linkedin: { Icon: FaLinkedin, color: "#0A66C2" },
  facebook: { Icon: SiFacebook, color: "#1877F2" },
  twitch: { Icon: SiTwitch, color: "#9146FF" },
  pinterest: { Icon: SiPinterest, color: "#E60023" },
  snapchat: { Icon: SiSnapchat, color: "#FFFC00" },
};

export function PlatformIcon({ platform, className = "h-4 w-4" }: { platform: string; className?: string }) {
  const key = platform.toLowerCase().trim();
  const entry = ICONS[key];
  if (!entry) return null;
  const { Icon, color } = entry;
  return <Icon className={className} style={{ color }} />;
}
