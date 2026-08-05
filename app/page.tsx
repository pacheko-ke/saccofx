import Image from "next/image";
import Sidebar from "@/components/SideBar";
import Main from "@/components/Main";
import Login from "@/components/Login";

export default function Home() {
  return (
    <div className="flex bg-white">
    <Sidebar></Sidebar>
    <Main></Main>

    </div>
  );
}
