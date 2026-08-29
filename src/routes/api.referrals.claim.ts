import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/chat-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/referrals/claim")({
  server: {
    handlers: {
      /** Attributes a newly-signed-up creator to whoever referred them. One referral per referred creator, ever - enforced by the table's UNIQUE constraint, not just app logic. */
      POST: async ({ request }) => {
        const referredCreatorId = await getUserIdFromRequest(request);
        if (!referredCreatorId) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { code: string };
        if (!body.code) return new Response("code required", { status: 400 });

        const { data: referrer } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("creator_handle", body.code)
          .maybeSingle();
        if (!referrer) return new Response("invalid referral code", { status: 404 });
        if (referrer.user_id === referredCreatorId) {
          return new Response("cannot refer yourself", { status: 400 });
        }

        const { data: referral, error } = await supabaseAdmin
          .from("ugc_referrals")
          .insert({ referrer_creator_id: referrer.user_id, referred_creator_id: referredCreatorId, code: body.code })
          .select("*")
          .single();

        if (error) {
          if ((error as { code?: string }).code === "23505") {
            return new Response("this creator is already attributed to a referral", { status: 409 });
          }
          return new Response(error.message, { status: 500 });
        }

        return Response.json({ referral });
      },
    },
  },
});
