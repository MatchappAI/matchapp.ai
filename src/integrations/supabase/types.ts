export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_activity: {
        Row: {
          action_label: string | null
          action_route: string | null
          activity_type: string
          created_at: string
          description: string | null
          id: string
          read: boolean
          related_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_route?: string | null
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          read?: boolean
          related_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_route?: string | null
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          read?: boolean
          related_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_audit_log: {
        Row: {
          action: string
          autonomy_level: number
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
          undone_at: string | null
          user_id: string
        }
        Insert: {
          action: string
          autonomy_level?: number
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          undone_at?: string | null
          user_id: string
        }
        Update: {
          action?: string
          autonomy_level?: number
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          undone_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_memory: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          action_result: Json | null
          action_triggered: string | null
          approval_status: string | null
          content: string
          created_at: string
          id: string
          inline_card_data: Json | null
          inline_card_type: string | null
          requires_approval: boolean
          role: string
          user_id: string
        }
        Insert: {
          action_result?: Json | null
          action_triggered?: string | null
          approval_status?: string | null
          content: string
          created_at?: string
          id?: string
          inline_card_data?: Json | null
          inline_card_type?: string | null
          requires_approval?: boolean
          role: string
          user_id: string
        }
        Update: {
          action_result?: Json | null
          action_triggered?: string | null
          approval_status?: string | null
          content?: string
          created_at?: string
          id?: string
          inline_card_data?: Json | null
          inline_card_type?: string | null
          requires_approval?: boolean
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_rules: {
        Row: {
          approval_before_send: boolean | null
          approval_contracts: boolean | null
          approval_deliverables: boolean | null
          approval_money_terms: boolean | null
          auto_follow_up: boolean | null
          auto_negotiate: boolean | null
          auto_outreach: boolean | null
          created_at: string
          id: string
          minimum_rate: number | null
          rules_configured: boolean
          target_rate: number | null
          updated_at: string
          user_id: string
          walk_away_rate: number | null
        }
        Insert: {
          approval_before_send?: boolean | null
          approval_contracts?: boolean | null
          approval_deliverables?: boolean | null
          approval_money_terms?: boolean | null
          auto_follow_up?: boolean | null
          auto_negotiate?: boolean | null
          auto_outreach?: boolean | null
          created_at?: string
          id?: string
          minimum_rate?: number | null
          rules_configured?: boolean
          target_rate?: number | null
          updated_at?: string
          user_id: string
          walk_away_rate?: number | null
        }
        Update: {
          approval_before_send?: boolean | null
          approval_contracts?: boolean | null
          approval_deliverables?: boolean | null
          approval_money_terms?: boolean | null
          auto_follow_up?: boolean | null
          auto_negotiate?: boolean | null
          auto_outreach?: boolean | null
          created_at?: string
          id?: string
          minimum_rate?: number | null
          rules_configured?: boolean
          target_rate?: number | null
          updated_at?: string
          user_id?: string
          walk_away_rate?: number | null
        }
        Relationships: []
      }
      ai_analysis: {
        Row: {
          analysis_summary: string | null
          best_brand_categories: string[] | null
          created_at: string
          creator_score: number | null
          first_brand_opportunities: string[] | null
          generated_at: string
          high_fit_deal_types: number | null
          id: string
          pricing_insight: string | null
          recommended_floor: number | null
          recommended_packages: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_summary?: string | null
          best_brand_categories?: string[] | null
          created_at?: string
          creator_score?: number | null
          first_brand_opportunities?: string[] | null
          generated_at?: string
          high_fit_deal_types?: number | null
          id?: string
          pricing_insight?: string | null
          recommended_floor?: number | null
          recommended_packages?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_summary?: string | null
          best_brand_categories?: string[] | null
          created_at?: string
          creator_score?: number | null
          first_brand_opportunities?: string[] | null
          generated_at?: string
          high_fit_deal_types?: number | null
          id?: string
          pricing_insight?: string | null
          recommended_floor?: number | null
          recommended_packages?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_replies: {
        Row: {
          accepted: boolean
          brand_reply_text: string | null
          created_at: string
          id: string
          outreach_id: string | null
          recommended_package: string | null
          risk_note: string | null
          sentiment_read: string | null
          suggested_reply: string | null
          user_id: string
        }
        Insert: {
          accepted?: boolean
          brand_reply_text?: string | null
          created_at?: string
          id?: string
          outreach_id?: string | null
          recommended_package?: string | null
          risk_note?: string | null
          sentiment_read?: string | null
          suggested_reply?: string | null
          user_id: string
        }
        Update: {
          accepted?: boolean
          brand_reply_text?: string | null
          created_at?: string
          id?: string
          outreach_id?: string | null
          recommended_package?: string | null
          risk_note?: string | null
          sentiment_read?: string | null
          suggested_reply?: string | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event: string
          id: string
          properties: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          properties?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          properties?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      apify_runs: {
        Row: {
          created_at: string
          handle: string
          id: string
          platform: string
          run_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          platform: string
          run_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          platform?: string
          run_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      approvals: {
        Row: {
          ai_recommendation: string | null
          amount: number | null
          approval_type: string
          brand_name: string | null
          created_at: string
          due_date: string | null
          id: string
          related_id: string | null
          related_table: string | null
          risk_note: string | null
          status: string
          updated_at: string
          user_id: string
          what_happens_next: string | null
        }
        Insert: {
          ai_recommendation?: string | null
          amount?: number | null
          approval_type: string
          brand_name?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          related_id?: string | null
          related_table?: string | null
          risk_note?: string | null
          status?: string
          updated_at?: string
          user_id: string
          what_happens_next?: string | null
        }
        Update: {
          ai_recommendation?: string | null
          amount?: number | null
          approval_type?: string
          brand_name?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          related_id?: string | null
          related_table?: string | null
          risk_note?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          what_happens_next?: string | null
        }
        Relationships: []
      }
      brand_contacts: {
        Row: {
          alternate_emails: Json | null
          bounce_history: Json
          brand_match_id: string
          confidence: string
          confidence_score: number | null
          contact_name: string | null
          contact_title: string | null
          created_at: string
          data_source: string | null
          domain: string | null
          email: string
          id: string
          is_alternate: boolean
          is_demo: boolean
          is_primary: boolean
          last_verified_at: string | null
          notes: string | null
          reply_history: Json
          role: string | null
          source: string
          updated_at: string
          user_id: string
          verification_status: string | null
          wrong_contact_at: string | null
        }
        Insert: {
          alternate_emails?: Json | null
          bounce_history?: Json
          brand_match_id: string
          confidence?: string
          confidence_score?: number | null
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string
          data_source?: string | null
          domain?: string | null
          email: string
          id?: string
          is_alternate?: boolean
          is_demo?: boolean
          is_primary?: boolean
          last_verified_at?: string | null
          notes?: string | null
          reply_history?: Json
          role?: string | null
          source: string
          updated_at?: string
          user_id: string
          verification_status?: string | null
          wrong_contact_at?: string | null
        }
        Update: {
          alternate_emails?: Json | null
          bounce_history?: Json
          brand_match_id?: string
          confidence?: string
          confidence_score?: number | null
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string
          data_source?: string | null
          domain?: string | null
          email?: string
          id?: string
          is_alternate?: boolean
          is_demo?: boolean
          is_primary?: boolean
          last_verified_at?: string | null
          notes?: string | null
          reply_history?: Json
          role?: string | null
          source?: string
          updated_at?: string
          user_id?: string
          verification_status?: string | null
          wrong_contact_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_contacts_brand_match_id_fkey"
            columns: ["brand_match_id"]
            isOneToOne: false
            referencedRelation: "brand_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_matches: {
        Row: {
          best_outreach_channel: string | null
          brand_industry: string | null
          brand_name: string
          contact_path: string | null
          created_at: string
          creator_verified: boolean
          data_source: string | null
          estimated_deal_max: number | null
          estimated_deal_min: number | null
          evidence: Json | null
          fit_quality_score: number | null
          fit_reasoning: string | null
          fit_score: number | null
          id: string
          is_demo: boolean
          market_type: string | null
          match_label: string | null
          my_take: string | null
          outreach_angle: string | null
          partnership_angle: string | null
          potential_risk: string | null
          recommended_next_move: string | null
          score_breakdown: Json | null
          status: string
          suggested_deliverables: Json | null
          suggested_package: string | null
          top_reasons: Json | null
          updated_at: string
          user_id: string
          what_to_avoid: string | null
          why_brand_cares: string | null
          why_creator_fits: string | null
        }
        Insert: {
          best_outreach_channel?: string | null
          brand_industry?: string | null
          brand_name: string
          contact_path?: string | null
          created_at?: string
          creator_verified?: boolean
          data_source?: string | null
          estimated_deal_max?: number | null
          estimated_deal_min?: number | null
          evidence?: Json | null
          fit_quality_score?: number | null
          fit_reasoning?: string | null
          fit_score?: number | null
          id?: string
          is_demo?: boolean
          market_type?: string | null
          match_label?: string | null
          my_take?: string | null
          outreach_angle?: string | null
          partnership_angle?: string | null
          potential_risk?: string | null
          recommended_next_move?: string | null
          score_breakdown?: Json | null
          status?: string
          suggested_deliverables?: Json | null
          suggested_package?: string | null
          top_reasons?: Json | null
          updated_at?: string
          user_id: string
          what_to_avoid?: string | null
          why_brand_cares?: string | null
          why_creator_fits?: string | null
        }
        Update: {
          best_outreach_channel?: string | null
          brand_industry?: string | null
          brand_name?: string
          contact_path?: string | null
          created_at?: string
          creator_verified?: boolean
          data_source?: string | null
          estimated_deal_max?: number | null
          estimated_deal_min?: number | null
          evidence?: Json | null
          fit_quality_score?: number | null
          fit_reasoning?: string | null
          fit_score?: number | null
          id?: string
          is_demo?: boolean
          market_type?: string | null
          match_label?: string | null
          my_take?: string | null
          outreach_angle?: string | null
          partnership_angle?: string | null
          potential_risk?: string | null
          recommended_next_move?: string | null
          score_breakdown?: Json | null
          status?: string
          suggested_deliverables?: Json | null
          suggested_package?: string | null
          top_reasons?: Json | null
          updated_at?: string
          user_id?: string
          what_to_avoid?: string | null
          why_brand_cares?: string | null
          why_creator_fits?: string | null
        }
        Relationships: []
      }
      brand_preferences: {
        Row: {
          additional_notes: string | null
          blocked_categories: string | null
          brand_size_preference: string | null
          brand_values: string | null
          configured: boolean
          created_at: string
          dream_brands: string | null
          dream_brands_text: string | null
          id: string
          location_restrictions: string | null
          preferred_categories: string | null
          updated_at: string
          user_id: string
          values_to_avoid: string | null
          worked_with_before: string | null
        }
        Insert: {
          additional_notes?: string | null
          blocked_categories?: string | null
          brand_size_preference?: string | null
          brand_values?: string | null
          configured?: boolean
          created_at?: string
          dream_brands?: string | null
          dream_brands_text?: string | null
          id?: string
          location_restrictions?: string | null
          preferred_categories?: string | null
          updated_at?: string
          user_id: string
          values_to_avoid?: string | null
          worked_with_before?: string | null
        }
        Update: {
          additional_notes?: string | null
          blocked_categories?: string | null
          brand_size_preference?: string | null
          brand_values?: string | null
          configured?: boolean
          created_at?: string
          dream_brands?: string | null
          dream_brands_text?: string | null
          id?: string
          location_restrictions?: string | null
          preferred_categories?: string | null
          updated_at?: string
          user_id?: string
          values_to_avoid?: string | null
          worked_with_before?: string | null
        }
        Relationships: []
      }
      chat_pending_actions: {
        Row: {
          action_type: string
          created_at: string
          expires_at: string
          id: string
          payload: Json
          status: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          expires_at?: string
          id?: string
          payload: Json
          status?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      connected_accounts: {
        Row: {
          account_email: string | null
          account_metadata: Json | null
          connected: boolean
          connected_at: string | null
          connection_id: string | null
          created_at: string
          id: string
          service: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          account_metadata?: Json | null
          connected?: boolean
          connected_at?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          service: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          account_metadata?: Json | null
          connected?: boolean
          connected_at?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          service?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          brand_name: string | null
          brand_signer_name: string | null
          contract_text: string | null
          created_at: string
          deal_id: string | null
          id: string
          key_clauses: string[] | null
          risk_notes: string[] | null
          sent_at: string | null
          signed_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_name?: string | null
          brand_signer_name?: string | null
          contract_text?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          key_clauses?: string[] | null
          risk_notes?: string[] | null
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_name?: string | null
          brand_signer_name?: string | null
          contract_text?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          key_clauses?: string[] | null
          risk_notes?: string[] | null
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_profiles: {
        Row: {
          agent_memory: Json
          approval_preference: string | null
          audience_age_band: string | null
          auto_outreach_comfort: boolean | null
          autonomy_level: string | null
          availability_hours: number | null
          average_deal_size: number | null
          bio: string | null
          blocked_industries: string | null
          confidence_level: string | null
          content_style: string | null
          content_themes: string[] | null
          created_at: string
          creator_notes: string | null
          cta_style: string | null
          deal_type_preference: string[] | null
          deals_per_month: number | null
          enriched_at: string | null
          enrichment_source: Json | null
          explanation_level: string | null
          follower_count: number | null
          full_name: string | null
          gifted_products_accepted: boolean | null
          growth_stage: string | null
          handle: string | null
          id: string
          language: string | null
          location: string | null
          market_scope: string
          media_kit_url: string | null
          min_deal_value: number | null
          monthly_income_goal: number | null
          niche: string | null
          past_brand_deals: number | null
          platforms: string[]
          posting_frequency: string | null
          preferred_industries: string | null
          pricing_aggressiveness: string | null
          primary_platform: string | null
          target_audience: string | null
          tone: string | null
          top_brands_mentioned: string[] | null
          updated_at: string
          user_id: string
          verification_skipped: boolean
          verification_status: string
          verified: boolean
          verified_at: string | null
          verified_handle: string | null
          verified_platform: string | null
          voice_formality: string | null
          voice_length: string | null
          voice_warmth: string | null
        }
        Insert: {
          agent_memory?: Json
          approval_preference?: string | null
          audience_age_band?: string | null
          auto_outreach_comfort?: boolean | null
          autonomy_level?: string | null
          availability_hours?: number | null
          average_deal_size?: number | null
          bio?: string | null
          blocked_industries?: string | null
          confidence_level?: string | null
          content_style?: string | null
          content_themes?: string[] | null
          created_at?: string
          creator_notes?: string | null
          cta_style?: string | null
          deal_type_preference?: string[] | null
          deals_per_month?: number | null
          enriched_at?: string | null
          enrichment_source?: Json | null
          explanation_level?: string | null
          follower_count?: number | null
          full_name?: string | null
          gifted_products_accepted?: boolean | null
          growth_stage?: string | null
          handle?: string | null
          id?: string
          language?: string | null
          location?: string | null
          market_scope?: string
          media_kit_url?: string | null
          min_deal_value?: number | null
          monthly_income_goal?: number | null
          niche?: string | null
          past_brand_deals?: number | null
          platforms?: string[]
          posting_frequency?: string | null
          preferred_industries?: string | null
          pricing_aggressiveness?: string | null
          primary_platform?: string | null
          target_audience?: string | null
          tone?: string | null
          top_brands_mentioned?: string[] | null
          updated_at?: string
          user_id: string
          verification_skipped?: boolean
          verification_status?: string
          verified?: boolean
          verified_at?: string | null
          verified_handle?: string | null
          verified_platform?: string | null
          voice_formality?: string | null
          voice_length?: string | null
          voice_warmth?: string | null
        }
        Update: {
          agent_memory?: Json
          approval_preference?: string | null
          audience_age_band?: string | null
          auto_outreach_comfort?: boolean | null
          autonomy_level?: string | null
          availability_hours?: number | null
          average_deal_size?: number | null
          bio?: string | null
          blocked_industries?: string | null
          confidence_level?: string | null
          content_style?: string | null
          content_themes?: string[] | null
          created_at?: string
          creator_notes?: string | null
          cta_style?: string | null
          deal_type_preference?: string[] | null
          deals_per_month?: number | null
          enriched_at?: string | null
          enrichment_source?: Json | null
          explanation_level?: string | null
          follower_count?: number | null
          full_name?: string | null
          gifted_products_accepted?: boolean | null
          growth_stage?: string | null
          handle?: string | null
          id?: string
          language?: string | null
          location?: string | null
          market_scope?: string
          media_kit_url?: string | null
          min_deal_value?: number | null
          monthly_income_goal?: number | null
          niche?: string | null
          past_brand_deals?: number | null
          platforms?: string[]
          posting_frequency?: string | null
          preferred_industries?: string | null
          pricing_aggressiveness?: string | null
          primary_platform?: string | null
          target_audience?: string | null
          tone?: string | null
          top_brands_mentioned?: string[] | null
          updated_at?: string
          user_id?: string
          verification_skipped?: boolean
          verification_status?: string
          verified?: boolean
          verified_at?: string | null
          verified_handle?: string | null
          verified_platform?: string | null
          voice_formality?: string | null
          voice_length?: string | null
          voice_warmth?: string | null
        }
        Relationships: []
      }
      cron_secret: {
        Row: {
          id: boolean
          secret: string
        }
        Insert: {
          id?: boolean
          secret: string
        }
        Update: {
          id?: boolean
          secret?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          attribution_evidence: Json | null
          brand_match_id: string | null
          brand_name: string
          contract_status: string
          created_at: string
          data_source: string | null
          deal_source: string
          deal_value: number | null
          deliverables: string | null
          escrow_status: string
          escrow_terms: string | null
          exclusivity: string | null
          id: string
          invoice_status: string
          is_demo: boolean
          non_commissionable_amount: number
          notes: string | null
          package_name: string | null
          payment_terms: string | null
          pricing_snapshot: Json | null
          revision_limit: number | null
          status: string
          success_fee_rate_locked: number | null
          timeline_days: number | null
          updated_at: string
          usage_rights: string | null
          user_id: string
        }
        Insert: {
          attribution_evidence?: Json | null
          brand_match_id?: string | null
          brand_name: string
          contract_status?: string
          created_at?: string
          data_source?: string | null
          deal_source?: string
          deal_value?: number | null
          deliverables?: string | null
          escrow_status?: string
          escrow_terms?: string | null
          exclusivity?: string | null
          id?: string
          invoice_status?: string
          is_demo?: boolean
          non_commissionable_amount?: number
          notes?: string | null
          package_name?: string | null
          payment_terms?: string | null
          pricing_snapshot?: Json | null
          revision_limit?: number | null
          status?: string
          success_fee_rate_locked?: number | null
          timeline_days?: number | null
          updated_at?: string
          usage_rights?: string | null
          user_id: string
        }
        Update: {
          attribution_evidence?: Json | null
          brand_match_id?: string | null
          brand_name?: string
          contract_status?: string
          created_at?: string
          data_source?: string | null
          deal_source?: string
          deal_value?: number | null
          deliverables?: string | null
          escrow_status?: string
          escrow_terms?: string | null
          exclusivity?: string | null
          id?: string
          invoice_status?: string
          is_demo?: boolean
          non_commissionable_amount?: number
          notes?: string | null
          package_name?: string | null
          payment_terms?: string | null
          pricing_snapshot?: Json | null
          revision_limit?: number | null
          status?: string
          success_fee_rate_locked?: number | null
          timeline_days?: number | null
          updated_at?: string
          usage_rights?: string | null
          user_id?: string
        }
        Relationships: []
      }
      deliverables: {
        Row: {
          approved_at: string | null
          brand_name: string | null
          caption_draft: string | null
          created_at: string
          deal_id: string | null
          deliverable_type: string | null
          file_url: string | null
          id: string
          notes: string | null
          post_date: string | null
          proof_url: string | null
          revision_notes: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          brand_name?: string | null
          caption_draft?: string | null
          created_at?: string
          deal_id?: string | null
          deliverable_type?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          post_date?: string | null
          proof_url?: string | null
          revision_notes?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          brand_name?: string | null
          caption_draft?: string | null
          created_at?: string
          deal_id?: string | null
          deliverable_type?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          post_date?: string | null
          proof_url?: string | null
          revision_notes?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demo_fallback_events: {
        Row: {
          attempted_real_count: number
          created_at: string
          fallback_count: number
          id: string
          reason: string
          user_id: string | null
        }
        Insert: {
          attempted_real_count?: number
          created_at?: string
          fallback_count?: number
          id?: string
          reason: string
          user_id?: string | null
        }
        Update: {
          attempted_real_count?: number
          created_at?: string
          fallback_count?: number
          id?: string
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      error_events: {
        Row: {
          area: string
          context: Json
          created_at: string
          id: string
          message: string
          user_id: string | null
        }
        Insert: {
          area: string
          context?: Json
          created_at?: string
          id?: string
          message: string
          user_id?: string | null
        }
        Update: {
          area?: string
          context?: Json
          created_at?: string
          id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      escrow_transactions: {
        Row: {
          auto_release_days: number
          brand_name: string | null
          commission_status: string
          created_at: string
          creator_net_v2: number | null
          currency: string
          deal_id: string | null
          dispute_reason: string | null
          dispute_resolved_at: string | null
          dispute_status: string
          disputed_at: string | null
          expected_payout_date: string | null
          funded_at: string | null
          funding_url: string | null
          gross_amount: number
          gross_cash_compensation: number | null
          id: string
          net_payout: number
          payment_processing_fee: number | null
          payout_method: string | null
          platform_fee: number
          public_token: string | null
          release_scheduled_at: string | null
          released_at: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          success_fee_amount: number | null
          terms_accepted_at: string | null
          terms_accepted_email: string | null
          terms_accepted_ip: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_release_days?: number
          brand_name?: string | null
          commission_status?: string
          created_at?: string
          creator_net_v2?: number | null
          currency?: string
          deal_id?: string | null
          dispute_reason?: string | null
          dispute_resolved_at?: string | null
          dispute_status?: string
          disputed_at?: string | null
          expected_payout_date?: string | null
          funded_at?: string | null
          funding_url?: string | null
          gross_amount?: number
          gross_cash_compensation?: number | null
          id?: string
          net_payout?: number
          payment_processing_fee?: number | null
          payout_method?: string | null
          platform_fee?: number
          public_token?: string | null
          release_scheduled_at?: string | null
          released_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          success_fee_amount?: number | null
          terms_accepted_at?: string | null
          terms_accepted_email?: string | null
          terms_accepted_ip?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_release_days?: number
          brand_name?: string | null
          commission_status?: string
          created_at?: string
          creator_net_v2?: number | null
          currency?: string
          deal_id?: string | null
          dispute_reason?: string | null
          dispute_resolved_at?: string | null
          dispute_status?: string
          disputed_at?: string | null
          expected_payout_date?: string | null
          funded_at?: string | null
          funding_url?: string | null
          gross_amount?: number
          gross_cash_compensation?: number | null
          id?: string
          net_payout?: number
          payment_processing_fee?: number | null
          payout_method?: string | null
          platform_fee?: number
          public_token?: string | null
          release_scheduled_at?: string | null
          released_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          success_fee_amount?: number | null
          terms_accepted_at?: string | null
          terms_accepted_email?: string | null
          terms_accepted_ip?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      follow_up_sequences: {
        Row: {
          ai_reason: string | null
          approved: boolean
          body: string | null
          body_strategy: string | null
          brand_name: string | null
          cancelled: boolean
          created_at: string
          id: string
          outreach_id: string | null
          scheduled_at: string | null
          sent: boolean
          sent_at: string | null
          sequence_number: number
          subject: string | null
          user_id: string
        }
        Insert: {
          ai_reason?: string | null
          approved?: boolean
          body?: string | null
          body_strategy?: string | null
          brand_name?: string | null
          cancelled?: boolean
          created_at?: string
          id?: string
          outreach_id?: string | null
          scheduled_at?: string | null
          sent?: boolean
          sent_at?: string | null
          sequence_number: number
          subject?: string | null
          user_id: string
        }
        Update: {
          ai_reason?: string | null
          approved?: boolean
          body?: string | null
          body_strategy?: string | null
          brand_name?: string | null
          cancelled?: boolean
          created_at?: string
          id?: string
          outreach_id?: string | null
          scheduled_at?: string | null
          sent?: boolean
          sent_at?: string | null
          sequence_number?: number
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      learning_insights: {
        Row: {
          applied: boolean
          created_at: string
          evidence: string | null
          expected_impact: string | null
          id: string
          insight_title: string
          recommendation: string | null
          user_id: string
        }
        Insert: {
          applied?: boolean
          created_at?: string
          evidence?: string | null
          expected_impact?: string | null
          id?: string
          insight_title: string
          recommendation?: string | null
          user_id: string
        }
        Update: {
          applied?: boolean
          created_at?: string
          evidence?: string | null
          expected_impact?: string | null
          id?: string
          insight_title?: string
          recommendation?: string | null
          user_id?: string
        }
        Relationships: []
      }
      negotiation_messages: {
        Row: {
          ai_recommendation: boolean
          created_at: string
          deal_id: string | null
          id: string
          message_text: string
          sender: string
          user_id: string
        }
        Insert: {
          ai_recommendation?: boolean
          created_at?: string
          deal_id?: string | null
          id?: string
          message_text: string
          sender: string
          user_id: string
        }
        Update: {
          ai_recommendation?: boolean
          created_at?: string
          deal_id?: string | null
          id?: string
          message_text?: string
          sender?: string
          user_id?: string
        }
        Relationships: []
      }
      negotiations: {
        Row: {
          awaiting_creator_approval: boolean
          brand_intent: string | null
          brand_match_id: string | null
          campaign_type: string | null
          created_at: string
          creator_minimum: number | null
          current_counter: number | null
          deal_id: string | null
          deliverables: Json
          exclusivity: string | null
          id: string
          initial_offer: number | null
          last_message_at: string | null
          next_recommended_action: string | null
          payment_terms: string | null
          recommended_target: number | null
          revision_rounds: number | null
          stage: string
          updated_at: string
          usage_rights: string | null
          user_id: string
        }
        Insert: {
          awaiting_creator_approval?: boolean
          brand_intent?: string | null
          brand_match_id?: string | null
          campaign_type?: string | null
          created_at?: string
          creator_minimum?: number | null
          current_counter?: number | null
          deal_id?: string | null
          deliverables?: Json
          exclusivity?: string | null
          id?: string
          initial_offer?: number | null
          last_message_at?: string | null
          next_recommended_action?: string | null
          payment_terms?: string | null
          recommended_target?: number | null
          revision_rounds?: number | null
          stage?: string
          updated_at?: string
          usage_rights?: string | null
          user_id: string
        }
        Update: {
          awaiting_creator_approval?: boolean
          brand_intent?: string | null
          brand_match_id?: string | null
          campaign_type?: string | null
          created_at?: string
          creator_minimum?: number | null
          current_counter?: number | null
          deal_id?: string | null
          deliverables?: Json
          exclusivity?: string | null
          id?: string
          initial_offer?: number | null
          last_message_at?: string | null
          next_recommended_action?: string | null
          payment_terms?: string | null
          recommended_target?: number | null
          revision_rounds?: number | null
          stage?: string
          updated_at?: string
          usage_rights?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiations_brand_match_id_fkey"
            columns: ["brand_match_id"]
            isOneToOne: false
            referencedRelation: "brand_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_route: string | null
          created_at: string
          description: string | null
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_route?: string | null
          created_at?: string
          description?: string | null
          id?: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_route?: string | null
          created_at?: string
          description?: string | null
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_messages: {
        Row: {
          content: string
          created_at: string
          extracted_data: Json | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          extracted_data?: Json | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          extracted_data?: Json | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      outreach_campaigns: {
        Row: {
          active: boolean
          allow_package_offers: boolean
          brand_match_ids: string[]
          brief: Json
          created_at: string
          daily_send_cap: number
          ends_at: string | null
          follow_up_count: number
          id: string
          max_deal_value_cents: number | null
          min_deal_value_cents: number
          mode: string
          name: string
          starts_at: string
          stop_on_bounce: boolean
          stop_on_reply: boolean
          stop_on_unsubscribe: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          allow_package_offers?: boolean
          brand_match_ids?: string[]
          brief?: Json
          created_at?: string
          daily_send_cap?: number
          ends_at?: string | null
          follow_up_count?: number
          id?: string
          max_deal_value_cents?: number | null
          min_deal_value_cents?: number
          mode?: string
          name: string
          starts_at?: string
          stop_on_bounce?: boolean
          stop_on_reply?: boolean
          stop_on_unsubscribe?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          allow_package_offers?: boolean
          brand_match_ids?: string[]
          brief?: Json
          created_at?: string
          daily_send_cap?: number
          ends_at?: string | null
          follow_up_count?: number
          id?: string
          max_deal_value_cents?: number | null
          min_deal_value_cents?: number
          mode?: string
          name?: string
          starts_at?: string
          stop_on_bounce?: boolean
          stop_on_reply?: boolean
          stop_on_unsubscribe?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      outreach_emails: {
        Row: {
          ai_generated: boolean
          ai_reason: string | null
          body: string
          bounce_count: number
          bounce_type: string | null
          bounced: boolean
          bounced_at: string | null
          brand_match_id: string | null
          brand_reply_text: string | null
          cancelled: boolean
          category_style: string | null
          click_count: number
          created_at: string
          data_source: string | null
          first_opened_at: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          is_demo: boolean
          last_clicked_at: string | null
          open_count: number
          opened: boolean
          performance_note: string | null
          personalization_used: string | null
          provider_message_id: string | null
          qualification_confidence: number | null
          qualification_reason: string | null
          quality_check: Json | null
          read_at: string | null
          replied: boolean
          reply_classification: string | null
          reply_classified_at: string | null
          scheduled_for: string | null
          send_provider: string
          sent: boolean
          sent_at: string | null
          subject: string
          to_email: string | null
          tracking_id: string | null
          user_id: string
          version: number
        }
        Insert: {
          ai_generated?: boolean
          ai_reason?: string | null
          body: string
          bounce_count?: number
          bounce_type?: string | null
          bounced?: boolean
          bounced_at?: string | null
          brand_match_id?: string | null
          brand_reply_text?: string | null
          cancelled?: boolean
          category_style?: string | null
          click_count?: number
          created_at?: string
          data_source?: string | null
          first_opened_at?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          is_demo?: boolean
          last_clicked_at?: string | null
          open_count?: number
          opened?: boolean
          performance_note?: string | null
          personalization_used?: string | null
          provider_message_id?: string | null
          qualification_confidence?: number | null
          qualification_reason?: string | null
          quality_check?: Json | null
          read_at?: string | null
          replied?: boolean
          reply_classification?: string | null
          reply_classified_at?: string | null
          scheduled_for?: string | null
          send_provider?: string
          sent?: boolean
          sent_at?: string | null
          subject: string
          to_email?: string | null
          tracking_id?: string | null
          user_id: string
          version?: number
        }
        Update: {
          ai_generated?: boolean
          ai_reason?: string | null
          body?: string
          bounce_count?: number
          bounce_type?: string | null
          bounced?: boolean
          bounced_at?: string | null
          brand_match_id?: string | null
          brand_reply_text?: string | null
          cancelled?: boolean
          category_style?: string | null
          click_count?: number
          created_at?: string
          data_source?: string | null
          first_opened_at?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          is_demo?: boolean
          last_clicked_at?: string | null
          open_count?: number
          opened?: boolean
          performance_note?: string | null
          personalization_used?: string | null
          provider_message_id?: string | null
          qualification_confidence?: number | null
          qualification_reason?: string | null
          quality_check?: Json | null
          read_at?: string | null
          replied?: boolean
          reply_classification?: string | null
          reply_classified_at?: string | null
          scheduled_for?: string | null
          send_provider?: string
          sent?: boolean
          sent_at?: string | null
          subject?: string
          to_email?: string | null
          tracking_id?: string | null
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          created_at: string
          escrow_default: boolean | null
          id: string
          invoice_details: string | null
          invoice_name: string | null
          payout_method: string | null
          setup_skipped: boolean
          stripe_account_id: string | null
          stripe_connected: boolean
          tax_form_type: string | null
          tax_info_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          escrow_default?: boolean | null
          id?: string
          invoice_details?: string | null
          invoice_name?: string | null
          payout_method?: string | null
          setup_skipped?: boolean
          stripe_account_id?: string | null
          stripe_connected?: boolean
          tax_form_type?: string | null
          tax_info_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          escrow_default?: boolean | null
          id?: string
          invoice_details?: string | null
          invoice_name?: string | null
          payout_method?: string | null
          setup_skipped?: boolean
          stripe_account_id?: string | null
          stripe_connected?: boolean
          tax_form_type?: string | null
          tax_info_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payout_attempts: {
        Row: {
          amount_cents: number
          created_at: string
          error: string | null
          id: string
          status: string
          stripe_transfer_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          error?: string | null
          id?: string
          status?: string
          stripe_transfer_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          error?: string | null
          id?: string
          status?: string
          stripe_transfer_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_stats: {
        Row: {
          audience_fit: string | null
          avg_likes: number | null
          avg_views: number | null
          best_post_views: number | null
          engagement_rate: number | null
          fetched_at: string
          follower_count: number | null
          handle: string | null
          id: string
          platform: string
          posting_cadence: string | null
          recent_post_snapshot: string | null
          top_content_categories: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audience_fit?: string | null
          avg_likes?: number | null
          avg_views?: number | null
          best_post_views?: number | null
          engagement_rate?: number | null
          fetched_at?: string
          follower_count?: number | null
          handle?: string | null
          id?: string
          platform: string
          posting_cadence?: string | null
          recent_post_snapshot?: string | null
          top_content_categories?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audience_fit?: string | null
          avg_likes?: number | null
          avg_views?: number | null
          best_post_views?: number | null
          engagement_rate?: number | null
          fetched_at?: string
          follower_count?: number | null
          handle?: string | null
          id?: string
          platform?: string
          posting_cadence?: string | null
          recent_post_snapshot?: string | null
          top_content_categories?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_verifications: {
        Row: {
          apify_run_id: string | null
          attempts: number
          contact_email: string | null
          contact_email_mask: string | null
          created_at: string
          email_code_hash: string | null
          email_code_sent_at: string | null
          expires_at: string
          failed_at: string | null
          handle: string
          id: string
          max_attempts: number
          method: string
          platform: string
          status: string
          user_id: string
          verification_code: string
          verified_at: string | null
        }
        Insert: {
          apify_run_id?: string | null
          attempts?: number
          contact_email?: string | null
          contact_email_mask?: string | null
          created_at?: string
          email_code_hash?: string | null
          email_code_sent_at?: string | null
          expires_at: string
          failed_at?: string | null
          handle: string
          id?: string
          max_attempts?: number
          method?: string
          platform: string
          status?: string
          user_id: string
          verification_code: string
          verified_at?: string | null
        }
        Update: {
          apify_run_id?: string | null
          attempts?: number
          contact_email?: string | null
          contact_email_mask?: string | null
          created_at?: string
          email_code_hash?: string | null
          email_code_sent_at?: string | null
          expires_at?: string
          failed_at?: string | null
          handle?: string
          id?: string
          max_attempts?: number
          method?: string
          platform?: string
          status?: string
          user_id?: string
          verification_code?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          bundle_discount: number | null
          configured: boolean
          created_at: string
          creator_note: string | null
          exclusivity_fee: number | null
          id: string
          rate_floor: number | null
          revision_fee: number | null
          rush_fee: number | null
          target_rate: number | null
          updated_at: string
          usage_rights_fee: number | null
          user_id: string
          walk_away_rate: number | null
        }
        Insert: {
          bundle_discount?: number | null
          configured?: boolean
          created_at?: string
          creator_note?: string | null
          exclusivity_fee?: number | null
          id?: string
          rate_floor?: number | null
          revision_fee?: number | null
          rush_fee?: number | null
          target_rate?: number | null
          updated_at?: string
          usage_rights_fee?: number | null
          user_id: string
          walk_away_rate?: number | null
        }
        Update: {
          bundle_discount?: number | null
          configured?: boolean
          created_at?: string
          creator_note?: string | null
          exclusivity_fee?: number | null
          id?: string
          rate_floor?: number | null
          revision_fee?: number | null
          rush_fee?: number | null
          target_rate?: number | null
          updated_at?: string
          usage_rights_fee?: number | null
          user_id?: string
          walk_away_rate?: number | null
        }
        Relationships: []
      }
      pricing_signals: {
        Row: {
          billing_cadence: string | null
          context: Json
          created_at: string
          id: string
          model_preference: string | null
          rationale: string | null
          user_id: string | null
          willingness_to_pay_cents: number | null
        }
        Insert: {
          billing_cadence?: string | null
          context?: Json
          created_at?: string
          id?: string
          model_preference?: string | null
          rationale?: string | null
          user_id?: string | null
          willingness_to_pay_cents?: number | null
        }
        Update: {
          billing_cadence?: string | null
          context?: Json
          created_at?: string
          id?: string
          model_preference?: string | null
          rationale?: string | null
          user_id?: string | null
          willingness_to_pay_cents?: number | null
        }
        Relationships: []
      }
      product_feedback: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json
          route: string | null
          sentiment: number | null
          source: string | null
          tags: string[] | null
          type: Database["public"]["Enums"]["feedback_type"]
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          route?: string | null
          sentiment?: number | null
          source?: string | null
          tags?: string[] | null
          type: Database["public"]["Enums"]["feedback_type"]
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          route?: string | null
          sentiment?: number | null
          source?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["feedback_type"]
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          affiliate_gifting_prefs: Json | null
          autonomy_level: number
          autopilot_daily_send_cap: number
          autopilot_daily_spend_cents: number
          avatar_url: string | null
          avoid_brands: string[]
          avoid_categories: string[]
          bio: string | null
          connected_platforms: string[]
          content_formats: string[]
          created_at: string
          creator_agreement_version: string | null
          creator_handle: string | null
          custom_category: string | null
          display_name: string | null
          dream_brands: string[]
          email: string | null
          free_access_status: string
          full_name: string | null
          id: string
          monetization_choice: string
          notification_prefs: Json
          onboarding_complete: boolean
          onboarding_step: number
          payout_mode: string
          physical_address: string | null
          plan: string
          primary_category: string | null
          qualified_reply_received_at: string | null
          secondary_categories: string[]
          sender_email: string | null
          stripe_connect_account_id: string | null
          stripe_connect_onboarded: boolean
          terms_accepted_at: string | null
          ugc_interest: boolean | null
          unsubscribe_footer_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_gifting_prefs?: Json | null
          autonomy_level?: number
          autopilot_daily_send_cap?: number
          autopilot_daily_spend_cents?: number
          avatar_url?: string | null
          avoid_brands?: string[]
          avoid_categories?: string[]
          bio?: string | null
          connected_platforms?: string[]
          content_formats?: string[]
          created_at?: string
          creator_agreement_version?: string | null
          creator_handle?: string | null
          custom_category?: string | null
          display_name?: string | null
          dream_brands?: string[]
          email?: string | null
          free_access_status?: string
          full_name?: string | null
          id?: string
          monetization_choice?: string
          notification_prefs?: Json
          onboarding_complete?: boolean
          onboarding_step?: number
          payout_mode?: string
          physical_address?: string | null
          plan?: string
          primary_category?: string | null
          qualified_reply_received_at?: string | null
          secondary_categories?: string[]
          sender_email?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded?: boolean
          terms_accepted_at?: string | null
          ugc_interest?: boolean | null
          unsubscribe_footer_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_gifting_prefs?: Json | null
          autonomy_level?: number
          autopilot_daily_send_cap?: number
          autopilot_daily_spend_cents?: number
          avatar_url?: string | null
          avoid_brands?: string[]
          avoid_categories?: string[]
          bio?: string | null
          connected_platforms?: string[]
          content_formats?: string[]
          created_at?: string
          creator_agreement_version?: string | null
          creator_handle?: string | null
          custom_category?: string | null
          display_name?: string | null
          dream_brands?: string[]
          email?: string | null
          free_access_status?: string
          full_name?: string | null
          id?: string
          monetization_choice?: string
          notification_prefs?: Json
          onboarding_complete?: boolean
          onboarding_step?: number
          payout_mode?: string
          physical_address?: string | null
          plan?: string
          primary_category?: string | null
          qualified_reply_received_at?: string | null
          secondary_categories?: string[]
          sender_email?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded?: boolean
          terms_accepted_at?: string | null
          ugc_interest?: boolean | null
          unsubscribe_footer_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_processed_events: {
        Row: {
          event_id: string
          event_type: string | null
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type?: string | null
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string | null
          processed_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      suppression_list: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          properties: Json
          route: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          properties?: Json
          route?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          properties?: Json
          route?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      usage_tracking: {
        Row: {
          action_type: string
          count: number
          id: string
          month_year: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          count?: number
          id?: string
          month_year: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          count?: number
          id?: string
          month_year?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          direction: string
          escrow_id: string | null
          id: string
          kind: string
          stripe_transfer_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description?: string | null
          direction: string
          escrow_id?: string | null
          id?: string
          kind: string
          stripe_transfer_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          direction?: string
          escrow_id?: string | null
          id?: string
          kind?: string
          stripe_transfer_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "user"
      feedback_type:
        | "icp"
        | "painpoint"
        | "feature_request"
        | "desire"
        | "feedback"
        | "pricing"
        | "sentiment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "user"],
      feedback_type: [
        "icp",
        "painpoint",
        "feature_request",
        "desire",
        "feedback",
        "pricing",
        "sentiment",
      ],
    },
  },
} as const
