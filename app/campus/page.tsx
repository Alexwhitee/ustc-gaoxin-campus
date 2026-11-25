import type { Metadata } from "next";
import CampusClient from "@/components/campus/game";
import { campusMeta } from "@/lib/campus/registry";

// 注意:metadata 在服务端只取静态元信息(不载入地图数据),运行时 ?campus= 的全量数据由客户端按需动态拉取
export const metadata: Metadata = {
  title: campusMeta().name,
  description: `${campusMeta().subtitle}:方向键或 WASD 走动,空格查看楼门口与路牌、和人说话,M 回总览。`,
};

export default function CampusPage() {
  return <CampusClient />;
}
