import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = {
  title: "第一次登入 | WinLab Video",
};

// Public guide for first-time users: set a password through the
// "Forgot or set password" flow, then sign in with it. The proxy matcher
// excludes /manual so people can read it before they have an account session.
const STEPS = [
  {
    title: "按 Forgot or set password",
    body: "打開 video.winlab.tw，登入畫面下方有 Forgot or set password，按下去。",
    image: "/manual/1-sign-in.webp",
    alt: "登入畫面，Sign in 按鈕下方是 Forgot or set password",
  },
  {
    title: "填公司信箱，按 Email me a code",
    body: "Email 欄填你的公司信箱，按 Email me a code。",
    image: "/manual/2-request-code.webp",
    alt: "Email 欄位與 Email me a code 按鈕",
  },
  {
    title: "到信箱拿驗證碼",
    body: "收一封 video.winlab.tw 寄來的信，裡面有 6 位數驗證碼。驗證碼 10 分鐘內有效，只能用一次。",
    image: "/manual/3-mail.webp",
    alt: "驗證碼信件，內容是 6 位數字",
  },
  {
    title: "填驗證碼並設定密碼",
    body: "回到網頁，填入驗證碼，新密碼填兩次，按 Save password and sign in。",
    image: "/manual/4-set-password.webp",
    alt: "驗證碼、New password、Confirm new password 欄位與 Save password and sign in 按鈕",
  },
  {
    title: "之後直接用密碼登入",
    body: "下次打開網站，Email 填公司信箱，Password 填剛設定的密碼，按 Sign in。",
    image: "/manual/1-sign-in.webp",
    alt: "登入畫面的 Email、Password 欄位與 Sign in 按鈕",
  },
];

export default function ManualPage() {
  return (
    <>
      <header className="flex w-full items-center gap-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="shrink-0 rounded-md text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          WinLab Video
        </Link>
        <span className="min-w-0 truncate text-sm text-muted-foreground">
          / 第一次登入
        </span>
        <Link
          href="/login"
          className="ml-auto shrink-0 rounded-md text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          前往登入
        </Link>
      </header>
      <PageContainer lang="zh-Hant" className="max-w-3xl">
        <section className="space-y-2">
          <h1 className="type-page-title">第一次登入</h1>
          <p className="text-sm text-muted-foreground">
            第一次使用要先用公司信箱設定密碼，之後就用這組密碼登入。
          </p>
        </section>

        <ol className="space-y-12">
          {STEPS.map((step, i) => (
            <li key={step.title} className="space-y-3">
              <h2 className="type-section">
                <span className="font-mono text-muted-foreground">{i + 1}.</span>{" "}
                {step.title}
              </h2>
              <p className="type-body">{step.body}</p>
              <Image
                src={step.image}
                alt={step.alt}
                width={1400}
                height={915}
                className="h-auto w-full"
                sizes="(min-width: 768px) 768px, 100vw"
                loading={i === 0 ? "eager" : "lazy"}
              />
            </li>
          ))}
        </ol>

        <section className="space-y-2 pb-16">
          <h2 className="type-section">收不到信</h2>
          <ul className="type-body list-disc space-y-1 pl-5">
            <li>先看垃圾郵件匣。</li>
            <li>畫面出現 not on the allow list，代表信箱還沒開通，請聯絡管理員。</li>
            <li>驗證碼過期就按 Send another code 重寄。</li>
          </ul>
        </section>
      </PageContainer>
    </>
  );
}
