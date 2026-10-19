import { site } from "@/lib/site";
import { GitHubIcon, InstagramIcon, LeetCodeIcon, LinkedInIcon } from "./Icons";

export const socialLinks = [
  { name: "GitHub", href: site.socials.github, Icon: GitHubIcon },
  { name: "LinkedIn", href: site.socials.linkedin, Icon: LinkedInIcon },
  { name: "LeetCode", href: site.socials.leetcode, Icon: LeetCodeIcon },
  { name: "Instagram", href: site.socials.instagram, Icon: InstagramIcon },
].filter((s) => s.href);

/** Floating vertical rail on the right edge. */
export function SocialRail() {
  return (
    <nav aria-label="Social links" className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 md:block">
      <ul className="flex flex-col gap-2 rounded-full border border-white/10 bg-black/55 p-2 backdrop-blur-md">
        {socialLinks.map(({ name, href, Icon }) => (
          <li key={name}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={name}
              title={name}
              className="grid h-10 w-10 place-items-center rounded-full text-white/90 transition hover:bg-amber-300 hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60"
            >
              <Icon className="h-[18px] w-[18px]" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
