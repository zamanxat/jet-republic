import { createClient } from 'npm:@supabase/supabase-js@2'

const FALLBACK = 'https://wa.me/7'

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const [{ data: mgrs, error: mE }, { data: settings, error: sE }] = await Promise.all([
      supabase.from('eseke-target-managers').select('id,total_leads,name,whatsapp_link').eq('is_active', true).order('created_at', { ascending: true }),
      supabase.from('eseke-target-settings').select('current_index').eq('id', 1).single()
    ])

    if (mE || sE || !mgrs?.length) {
      return Response.redirect(FALLBACK, 302)
    }

    let idx = settings?.current_index ?? 0
    if (idx >= mgrs.length) idx = 0
    const mgr = mgrs[idx]
    const next = (idx + 1) % mgrs.length

    const url = mgr.whatsapp_link || FALLBACK

    Promise.all([
      supabase.from('eseke-target-settings').update({ current_index: next, updated_at: new Date().toISOString() }).eq('id', 1),
      supabase.from('eseke-target-managers').update({ total_leads: (mgr.total_leads ?? 0) + 1 }).eq('id', mgr.id),
      supabase.from('eseke-target-leads').insert({ manager_id: mgr.id, manager_name: mgr.name, user_agent: req.headers.get('user-agent') ?? '', referrer: req.headers.get('referer') ?? '' })
    ]).catch(() => {})

    return Response.redirect(url, 302)
  } catch {
    return Response.redirect(FALLBACK, 302)
  }
})
