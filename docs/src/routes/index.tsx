import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex flex-col items-start flex-1 px-16 py-8">
        <h1 className="font-bold text-5xl mb-4">
          Gaming<span className="text-fd-primary">TS</span>
        </h1>
        <p className="text-lg text-fd-muted-foreground mb-6">
          A TypeScript Extension for writing Genius Invokation TCG cards.
        </p>
        <Link
          to="/docs/$"
          params={{
            _splat: "",
          }}
          className="px-3 py-2 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium text-sm"
        >
          Open Docs
        </Link>
      </div>
    </HomeLayout>
  );
}
