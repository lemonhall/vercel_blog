import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type RecipeTagPageProps = {
  params: Promise<{ tag: string }>;
};

export default async function RecipeTagPage({ params }: RecipeTagPageProps) {
  const { tag } = await params;
  redirect(`/recipes?tags=${encodeURIComponent(tag)}`);
}
