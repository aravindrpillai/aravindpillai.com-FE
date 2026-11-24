import QChatRegister from "@/pages/qchat/QChatRegister";

/** QuickChat management keeps its own password (QCHAT_ADMIN_PW) on top of the admin panel's. */
export default function QChatTab() {
  return <QChatRegister />;
}
