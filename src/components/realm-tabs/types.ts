import type { Realm, RealmStatus } from "@/types/realm";
import type { ToastType } from "@/components/Toast";

export interface TabProps {
  realm: Realm;
  realmStatus: RealmStatus | null;
  onToast: (message: string, type?: ToastType) => void;
  onRefresh: () => void;
}
