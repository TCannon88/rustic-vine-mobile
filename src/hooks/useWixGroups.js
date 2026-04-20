/**
 * useWixGroups — Wix Groups API integration
 *
 * Wraps @wix/groups SDK to:
 *   - Fetch group info + member count
 *   - Check current member's membership status
 *   - List recent group members (activity feed)
 *   - Submit a join request
 *   - List pending join requests for current user
 */

import { useState, useEffect, useCallback } from 'react'
import { getWixClient } from './useWixAuth.js'

const GROUP_ID   = import.meta.env.VITE_WIX_INSIDERS_GROUP_ID || ''
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || ''

/**
 * Membership status values:
 *   'unknown'  — not checked yet
 *   'none'     — not a member, no pending request
 *   'pending'  — join request submitted, awaiting approval
 *   'member'   — full group member
 */

export function useWixGroups({ tokens, currentMember, enabled = true } = {}) {
  const [groupInfo,        setGroupInfo]        = useState(null)
  const [membershipStatus, setMembershipStatus] = useState('unknown')
  const [recentMembers,    setRecentMembers]    = useState([])
  const [loading,          setLoading]          = useState(true)
  const [actionLoading,    setActionLoading]    = useState(false)
  const [error,            setError]            = useState(null)

  const isConfigured = !!GROUP_ID

  // ── Load group data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !isConfigured) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const client = getWixClient(tokens)

      // 1. Fetch group info (public — API key is sufficient)
      try {
        const res = await client.groups.getGroup(GROUP_ID)
        if (!cancelled) setGroupInfo(normaliseGroup(res))
      } catch (err) {
        console.error('[useWixGroups] getGroup error:', err)
        if (!cancelled) setError('Could not load group info.')
      }

      // 2. Check membership status (requires member auth)
      if (currentMember?._id) {
        // Debug: log member shape once so we can inspect in DevTools
        console.log('[useWixGroups] currentMember:', JSON.stringify(currentMember, null, 2))
        try {
          // Admin bypass: site owner always gets member access
          const memberEmail = (currentMember?.loginEmail ?? currentMember?.profile?.email ?? '').toLowerCase()
          const memberRole  = (currentMember?.role ?? currentMember?.roles?.[0]?.title ?? '').toLowerCase()
          const isAdmin = !!(ADMIN_EMAIL && memberEmail === ADMIN_EMAIL.toLowerCase())
                       || memberRole === 'admin'
                       || memberRole === 'owner'
                       || memberRole === 'site_member_owner'
          if (isAdmin) {
            if (!cancelled) setMembershipStatus('member')
          } else {
            const membershipRes = await client.groupMembers
              .queryGroupMembers()
              .eq('groupId', GROUP_ID)
              .eq('memberId', currentMember._id)
              .limit(1)
              .find()

            if (membershipRes.items?.length > 0) {
              if (!cancelled) setMembershipStatus('member')
            } else {
              // Check for pending join request
              try {
                const pendingRes = await client.joinGroupRequests
                  .queryJoinGroupRequests()
                  .eq('groupId', GROUP_ID)
                  .eq('memberId', currentMember._id)
                  .limit(1)
                  .find()

                if (!cancelled) {
                  setMembershipStatus(pendingRes.items?.length > 0 ? 'pending' : 'none')
                }
              } catch {
                if (!cancelled) setMembershipStatus('none')
              }
            }
          }
        } catch (err) {
          console.error('[useWixGroups] membership check error:', err)
          if (!cancelled) setMembershipStatus('none')
        }
      } else {
        if (!cancelled) setMembershipStatus('none')
      }

      // 3. Fetch recent group members (for activity feed — visible to members)
      try {
        const membersRes = await client.groupMembers
          .queryGroupMembers()
          .eq('groupId', GROUP_ID)
          .descending('joinedDate')
          .limit(12)
          .find()

        if (!cancelled) {
          setRecentMembers((membersRes.items ?? []).map(normaliseMember))
        }
      } catch (err) {
        console.error('[useWixGroups] listGroupMembers error:', err)
        // Non-fatal — member list may require membership
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [tokens, currentMember?._id, enabled, isConfigured])

  // ── Join group ─────────────────────────────────────────────────────────────
  const requestJoin = useCallback(async () => {
    if (!GROUP_ID || !tokens) return
    setActionLoading(true)
    setError(null)

    try {
      const client = getWixClient(tokens)

      // Try direct join first; if group requires approval, create a request
      try {
        await client.groupMembers.addGroupMembers(GROUP_ID, {
          memberIds: [currentMember._id],
        })
        setMembershipStatus('member')
      } catch {
        // Group may require owner approval — submit a join request instead
        await client.joinGroupRequests.createJoinGroupRequest
          ? await client.joinGroupRequests.createJoinGroupRequest(GROUP_ID)
          : null
        setMembershipStatus('pending')
      }
    } catch (err) {
      console.error('[useWixGroups] join error:', err)
      setError('Could not send join request. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }, [tokens, currentMember?._id])

  return {
    groupInfo,
    membershipStatus,
    recentMembers,
    loading,
    actionLoading,
    error,
    isConfigured,
    requestJoin,
  }
}

// ── Normalisers ───────────────────────────────────────────────────────────────

function normaliseGroup(g) {
  return {
    id:          g.id ?? g._id,
    name:        g.name,
    description: g.description,
    memberCount: g.memberCount ?? g.membersCount ?? 0,
    coverImage:  g.coverImage?.image?.url ?? null,
    privacyStatus: g.privacyStatus,  // 'PUBLIC' | 'PRIVATE' | 'SECRET'
  }
}

function normaliseMember(m) {
  const profile = m.member?.profile ?? {}
  return {
    id:         m.memberId,
    name:       profile.nickname ?? profile.name?.nick ?? profile.name?.full ?? 'Community Member',
    photo:      profile.photo?.url ?? null,
    joinedDate: m.joinedDate,
    role:       m.role?.title ?? null,
  }
}
