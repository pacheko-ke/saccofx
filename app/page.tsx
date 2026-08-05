import Image from "next/image";
import Sidebar from "@/components/SideBar";
import Main from "@/components/Main";

export default function Home() {
  return (
    <div className="flex h-screen">
    <Sidebar></Sidebar>
    <Main></Main>
    </div>
  );
}
