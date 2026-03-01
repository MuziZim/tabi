-- ============================================
-- MIGRATION: Trip Sharing (invite by email)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Invite a member by email
-- Looks up the user in auth.users, checks ownership, inserts into trip_members.
CREATE OR REPLACE FUNCTION public.invite_trip_member(
  p_trip_id uuid,
  p_email text,
  p_role text DEFAULT 'editor'
)
RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_caller_role text;
BEGIN
  -- Validate role
  IF p_role NOT IN ('editor', 'viewer') THEN
    RETURN json_build_object('error', 'Role must be editor or viewer');
  END IF;

  -- Check caller is owner of this trip
  SELECT role INTO v_caller_role
  FROM public.trip_members
  WHERE trip_id = p_trip_id AND user_id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role != 'owner' THEN
    RETURN json_build_object('error', 'Only trip owners can invite members');
  END IF;

  -- Look up user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(trim(p_email));

  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'No account found with that email. They need to sign up first.');
  END IF;

  -- Can't invite yourself
  IF v_user_id = auth.uid() THEN
    RETURN json_build_object('error', 'You are already the owner of this trip');
  END IF;

  -- Check not already a member
  IF EXISTS (SELECT 1 FROM public.trip_members WHERE trip_id = p_trip_id AND user_id = v_user_id) THEN
    RETURN json_build_object('error', 'This person is already a trip member');
  END IF;

  -- Add member
  INSERT INTO public.trip_members (trip_id, user_id, role)
  VALUES (p_trip_id, v_user_id, p_role);

  RETURN json_build_object('ok', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Get member emails (only visible to fellow trip members)
CREATE OR REPLACE FUNCTION public.get_trip_member_emails(p_trip_id uuid)
RETURNS TABLE(user_id uuid, email text, role text) AS $$
BEGIN
  -- Verify caller is a member of this trip
  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = p_trip_id AND trip_members.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT tm.user_id, u.email::text, tm.role
  FROM public.trip_members tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE tm.trip_id = p_trip_id
  ORDER BY tm.joined_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Remove a member (owners can remove anyone except themselves; members can leave)
CREATE OR REPLACE FUNCTION public.remove_trip_member(
  p_trip_id uuid,
  p_user_id uuid
)
RETURNS json AS $$
DECLARE
  v_caller_role text;
  v_target_role text;
BEGIN
  -- Get caller's role
  SELECT role INTO v_caller_role
  FROM public.trip_members
  WHERE trip_id = p_trip_id AND user_id = auth.uid();

  -- Get target's role
  SELECT role INTO v_target_role
  FROM public.trip_members
  WHERE trip_id = p_trip_id AND user_id = p_user_id;

  IF v_target_role IS NULL THEN
    RETURN json_build_object('error', 'Member not found');
  END IF;

  -- Can't remove the owner
  IF v_target_role = 'owner' THEN
    RETURN json_build_object('error', 'Cannot remove the trip owner');
  END IF;

  -- Must be owner, or removing yourself (leaving)
  IF v_caller_role != 'owner' AND auth.uid() != p_user_id THEN
    RETURN json_build_object('error', 'Only owners can remove other members');
  END IF;

  DELETE FROM public.trip_members
  WHERE trip_id = p_trip_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
