"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { LoginDialog } from "@/components/forum/login-dialog";
import { toast } from "sonner";

export function FollowButton({ userId }: { userId: string }) {
  const { me } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (!me) {
      setFollowing(false);
      setLoaded(true);
      return;
    }
    fetch(`/api/users/${userId}/follow`)
      .then((r) => r.json())
      .then((d) => setFollowing(Boolean(d.following)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [me, userId]);

  if (me?.id === userId) return null;

  const toggle = async () => {
    if (!me) {
      setLoginOpen(true);
      return;
    }
    const prev = following;
    setFollowing(!following);
    try {
      const res = await fetch(`/api/users/${userId}/follow`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFollowing(data.following);
    } catch {
      setFollowing(prev);
      toast.error("操作失败，请重试");
    }
  };

  return (
    <>
      <Button
        variant={following ? "outline" : "default"}
        size="sm"
        className="shrink-0 rounded-lg"
        disabled={!loaded}
        onClick={toggle}
      >
        {following ? "已关注" : "关注"}
      </Button>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
