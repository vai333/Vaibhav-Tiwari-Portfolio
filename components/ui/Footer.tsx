import { site } from "@/lib/site";
import { MailIcon } from "./Icons";
import { socialLinks } from "./Socials";

export function Footer() {
  return (
    <footer id="contact" className="relative flex min-h-[80vh] items-end px-4 pb-8 md:px-16 md:pb-12">
      <div className="w-full rounded-3xl border border-white/15 bg-black/70 p-6 text-white backdrop-blur-xl md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">What&apos;s next</p>
        <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight md:text-6xl">Let&apos;s build the next chapter.</h2>
        <a
          href={`mailto:${site.email}`}
          className="mt-8 inline-flex items-center gap-3 rounded-full bg-amber-300 px-6 py-3.5 text-base font-bold text-black transition hover:bg-amber-200"
        >
          <MailIcon className="h-5 w-5" />
          {site.email}
        </a>
        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm font-medium text-white/80 md:flex-row md:items-center md:justify-between">
          <span>© {site.name}</span>
          <ul className="flex gap-2">
            {socialLinks.map(({ name, href, Icon }) => (
              <li key={name}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={name}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
