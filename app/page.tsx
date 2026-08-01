import NextLevelAthlete from "@/components/next-level-athlete"

export default function Page() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0d1015",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 12px",
      }}
    >
      <NextLevelAthlete />
    </main>
  )
}
