"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import { ChevronDown, ChevronUp, History, Loader2, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type AuditRow = { id:string; admin_user_id:string; action:string; target_type:string|null; target_id:string|null; details:unknown; created_at:string };
type ProfileRow = { id:string; username:string|null };
type ManagedAudit = AuditRow & { adminUsername:string|null };
const PAGE_SIZE = 100;

function formatJapanDateTime(value:string|null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(value));
}
function actionLabel(action:string) {
  const labels:Record<string,string> = {
    suspend_user:"ユーザー利用停止", restore_user:"ユーザー復旧",
    hide_deal:"投稿を非表示", restore_deal:"投稿を復元",
    hide_comment:"コメントを非表示", restore_comment:"コメントを復元",
    hide_reply:"返信を非表示", restore_reply:"返信を復元",
    report_pending:"通報を未対応に変更", report_reviewed:"通報を確認済みに変更",
    report_dismissed:"通報を却下", report_actioned:"通報を対応済みに変更",
    action_report_hide_target:"通報対象を非表示・対応済み"
  };
  return labels[action] ?? action;
}
function targetLabel(type:string|null) {
  return ({user:"ユーザー",deal:"投稿",comment:"コメント",reply:"返信",report:"通報"} as Record<string,string>)[type ?? ""] ?? type ?? "—";
}
function detailText(details:unknown) {
  if (details == null) return "";
  if (typeof details === "string") return details;
  try { return JSON.stringify(details,null,2); } catch { return String(details); }
}

export default function AdminAuditLogsPage() {
  const [loading,setLoading] = useState(true);
  const [logs,setLogs] = useState<ManagedAudit[]>([]);
  const [currentPage,setCurrentPage] = useState(1);
  const [totalCount,setTotalCount] = useState(0);
  const [searchText,setSearchText] = useState("");
  const [actionFilter,setActionFilter] = useState("all");
  const [errorMessage,setErrorMessage] = useState("");
  const [expandedId,setExpandedId] = useState<string|null>(null);

  const loadLogs = async (page = currentPage) => {
    setLoading(true); setErrorMessage("");
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const {data:rows,error,count} = await supabase.from("admin_audit_logs")
      .select("id, admin_user_id, action, target_type, target_id, details, created_at",{count:"exact"})
      .order("created_at",{ascending:false}).range(from,to);
    if (error) { console.error("Admin audit logs load error:",error); setErrorMessage("操作履歴を取得できませんでした。"); setLoading(false); return; }
    const auditRows=(rows??[]) as AuditRow[];
    setTotalCount(count ?? 0);
    setCurrentPage(page);
    const adminIds=Array.from(new Set(auditRows.map(r=>r.admin_user_id).filter((id):id is string=>Boolean(id))));
    let profileMap=new Map<string,string|null>();
    if(adminIds.length){
      const {data:profiles,error:profileError}=await supabase.from("profiles").select("id, username").in("id",adminIds);
      if(profileError){ console.error("Admin audit profiles load error:",profileError); setErrorMessage("操作履歴は取得できましたが、管理者名を取得できませんでした。"); }
      else profileMap=new Map(((profiles??[]) as ProfileRow[]).map(p=>[p.id,p.username]));
    }
    setLogs(auditRows.map(r=>({...r,adminUsername:profileMap.get(r.admin_user_id)??null}))); setLoading(false);
  };

  useEffect(()=>{
    void loadLogs(1);
  },[]);


  const actionOptions=useMemo(()=>Array.from(new Set(logs.map(l=>l.action))).sort(),[logs]);
  const filteredLogs=useMemo(()=>{
    const k=searchText.trim().toLocaleLowerCase("ja-JP");
    return logs.filter(log=>{
      if(actionFilter!=="all"&&log.action!==actionFilter)return false;
      if(!k)return true;
      return [actionLabel(log.action),log.action,log.adminUsername??"",log.admin_user_id,targetLabel(log.target_type),log.target_type??"",log.target_id??"",detailText(log.details)]
        .some(v=>v.toLocaleLowerCase("ja-JP").includes(k));
    });
  },[actionFilter,logs,searchText]);

  const totalPages=Math.max(1,Math.ceil(totalCount/PAGE_SIZE));
  const pageStart=totalCount===0?0:(currentPage-1)*PAGE_SIZE+1;
  const pageEnd=Math.min(currentPage*PAGE_SIZE,totalCount);

  const pageNumbers=useMemo(()=>{
    const values=new Set<number>([1,totalPages,currentPage-1,currentPage,currentPage+1]);
    return Array.from(values).filter(page=>page>=1&&page<=totalPages).sort((a,b)=>a-b);
  },[currentPage,totalPages]);

  const changePage=(page:number)=>{
    if(loading||page<1||page>totalPages||page===currentPage)return;
    setExpandedId(null);
    void loadLogs(page);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  return <>
    <div className="mb-4">
      <h1 className="text-2xl font-bold tracking-tight text-[#001e43] sm:text-3xl">管理操作履歴</h1>
      <p className="mt-1 text-sm text-slate-600">運営による変更・モデレーション・通報対応の履歴を確認します。</p>
    </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard label="全操作履歴" value={totalCount}/>
        <SummaryCard label="操作種類" value={new Set(logs.map(l=>l.action)).size}/>
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">最新操作</div>
          <div className="mt-2 text-sm font-bold text-[#001e43]">{logs[0]?formatJapanDateTime(logs[0].created_at):"—"}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
              <input type="search" value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="操作・管理者・対象ID・詳細で検索" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#006888]"/>
            </div>
            <div className="flex gap-2">
              <select value={actionFilter} onChange={e=>setActionFilter(e.target.value)} className="max-w-[220px] cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none">
                <option value="all">すべての操作</option>
                {actionOptions.map(a=><option key={a} value={a}>{actionLabel(a)}</option>)}
              </select>
              <button type="button" onClick={()=>void loadLogs(currentPage)} disabled={loading} className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" aria-label="再読み込み"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></button>
            </div>
          </div>
        </div>

        {errorMessage?<div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>:null}
        {loading?<div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>操作履歴を読み込んでいます...</div>
        :filteredLogs.length===0?<div className="px-4 py-16 text-center text-sm text-slate-500">条件に一致する操作履歴はありません。</div>
        :<>
          <div className="hidden md:block">
            <table className="w-full table-fixed text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="w-[16%] px-2 py-3">日時</th><th className="w-[17%] px-2 py-3">管理者</th><th className="w-[24%] px-2 py-3">操作</th><th className="w-[10%] px-2 py-3">対象</th><th className="w-[23%] px-2 py-3">対象ID</th><th className="w-[10%] px-2 py-3 text-right">詳細</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(log=>{
                  const expanded=expandedId===log.id, details=detailText(log.details);
                  return <Fragment key={log.id}>
                    <tr className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-2 py-4 text-xs text-slate-600">{formatJapanDateTime(log.created_at)}</td>
                      <td className="px-2 py-4"><div className="text-sm font-semibold text-slate-700">{log.adminUsername||"ユーザー名未設定"}</div><div className="mt-1 truncate font-mono text-[10px] text-slate-400">{log.admin_user_id}</div></td>
                      <td className="px-2 py-4"><span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#006888]/10 px-2.5 py-1 text-xs font-semibold text-[#006888]"><History className="h-3.5 w-3.5"/>{actionLabel(log.action)}</span></td>
                      <td className="px-2 py-4 text-sm font-semibold text-slate-600">{targetLabel(log.target_type)}</td>
                      <td className="min-w-0 px-2 py-4"><div className="truncate font-mono text-xs text-slate-500">{log.target_id||"—"}</div></td>
                      <td className="px-2 py-4 text-right">{details?<button type="button" onClick={()=>setExpandedId(expanded?null:log.id)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#001e43] hover:bg-slate-50">{expanded?<ChevronUp className="h-3.5 w-3.5"/>:<ChevronDown className="h-3.5 w-3.5"/>}{expanded?"閉じる":"表示"}</button>:<span className="text-xs text-slate-400">—</span>}</td>
                    </tr>
                    {expanded&&details?<tr><td colSpan={6} className="bg-slate-50 px-4 py-3"><AuditDetails details={log.details}/></td></tr>:null}
                  </Fragment>
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {filteredLogs.map(log=>{
              const expanded=expandedId===log.id, details=detailText(log.details);
              return <article key={log.id} className="p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><History className="h-4 w-4 flex-none text-[#006888]"/><span className="font-bold text-[#001e43]">{actionLabel(log.action)}</span></div><div className="mt-1 text-xs text-slate-400">{formatJapanDateTime(log.created_at)}</div></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{targetLabel(log.target_type)}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3"><MobileInfo label="管理者" value={log.adminUsername||"ユーザー名未設定"}/><MobileInfo label="対象ID" value={log.target_id||"—"}/></div>
                {details?<><button type="button" onClick={()=>setExpandedId(expanded?null:log.id)} className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#006888]">{expanded?<ChevronUp className="h-3.5 w-3.5"/>:<ChevronDown className="h-3.5 w-3.5"/>}{expanded?"詳細を閉じる":"詳細を表示"}</button>{expanded?<div className="mt-2"><AuditDetails details={log.details}/></div>:null}</>:null}
              </article>
            })}
          </div>
        </>}
      </div>
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-400">
        全{totalCount.toLocaleString("ja-JP")}件中 {pageStart.toLocaleString("ja-JP")}〜{pageEnd.toLocaleString("ja-JP")}件を表示・日時は日本時間です。
      </p>
      {totalPages>1?(
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={()=>changePage(currentPage-1)} disabled={loading||currentPage===1} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#001e43] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">前へ</button>
          {pageNumbers.map((page,index)=>{
            const previous=pageNumbers[index-1];
            const showEllipsis=previous!==undefined&&page-previous>1;
            return <span key={page} className="contents">
              {showEllipsis?<span className="px-1 text-xs text-slate-400">…</span>:null}
              <button type="button" onClick={()=>changePage(page)} disabled={loading} className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${page===currentPage?"border-[#006888] bg-[#006888] text-white":"border-slate-300 bg-white text-[#001e43] hover:bg-slate-50"}`}>{page}</button>
            </span>;
          })}
          <button type="button" onClick={()=>changePage(currentPage+1)} disabled={loading||currentPage===totalPages} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#001e43] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">次へ</button>
        </div>
      ):null}
    </div>
  </>;
}

function friendlyStatus(value: unknown) {
  const labels: Record<string, string> = {
    pending: "未対応", reviewed: "確認済み", dismissed: "却下", actioned: "対応済み",
    visible: "公開", hidden: "非表示", active: "通常", suspended: "利用停止",
  };
  const key=String(value ?? "");
  return labels[key] ?? key;
}

function friendlyTargetType(value: unknown) {
  const labels: Record<string, string> = {
    comment: "コメント", reply: "返信", deal: "投稿", user: "ユーザー", report: "通報",
  };
  const key=String(value ?? "");
  return labels[key] ?? key;
}

function AuditDetails({details}:{details:unknown}) {
  if(!details || typeof details!=="object" || Array.isArray(details)) {
    return <div className="text-sm text-slate-600">詳細情報はありません。</div>;
  }
  const d=details as Record<string,unknown>;
  const rows:{label:string;value:string}[]=[];

  if("previous_status" in d || "new_status" in d) {
    rows.push({label:"ステータス変更",value:`${friendlyStatus(d.previous_status)} → ${friendlyStatus(d.new_status)}`});
  }
  if(d.target_type) rows.push({label:"対象",value:friendlyTargetType(d.target_type)});
  if(d.target_id) rows.push({label:"対象ID",value:String(d.target_id)});
  if(d.reason) rows.push({label:"理由",value:String(d.reason)});
  if(d.username) rows.push({label:"ユーザー名",value:String(d.username)});

  const labels:Record<string,string>={
    previous_report_status:"変更前の通報状態",
    new_report_status:"変更後の通報状態",
    target_was_already_hidden:"対象はすでに非表示",
    previous_moderation_status:"変更前の公開状態",
    new_moderation_status:"変更後の公開状態",
    moderation_reason:"非表示理由",
  };
  const handled=new Set(["previous_status","new_status","target_type","target_id","reason","username"]);
  for(const [key,value] of Object.entries(d)) {
    if(handled.has(key) || value==null) continue;
    let display=typeof value==="boolean" ? (value?"はい":"いいえ") : String(value);
    if(key.includes("status")) display=friendlyStatus(value);
    rows.push({label:labels[key] ?? key,value:display});
  }

  return <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map((row,index)=><div key={`${row.label}-${index}`} className="min-w-0 rounded-lg bg-slate-50 px-3 py-2.5">
        <dt className="text-[11px] font-semibold text-slate-500">{row.label}</dt>
        <dd className="mt-1 break-all text-sm font-semibold text-slate-800">{row.value}</dd>
      </div>)}
    </dl>
  </div>;
}

function SummaryCard({label,value}:{label:string;value:number}) {
  return <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="text-xs font-semibold text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold text-[#001e43]">{value.toLocaleString("ja-JP")}</div></div>;
}
function MobileInfo({label,value}:{label:string;value:string}) {
  return <div className="min-w-0"><div className="text-[10px] font-semibold text-slate-400">{label}</div><div className="mt-1 truncate text-xs font-bold text-slate-700">{value}</div></div>;
}
