 "use client";
import Link from "next/link";
import {useState} from "react";
import {getSupabase} from "@/lib/supabase";
export default function Login(){
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [msg,setMsg]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMsg("");try{const {error}=await getSupabase().auth.signInWithPassword({email,password});if(error)throw error;window.location.href="/dashboard"}catch(x){setMsg(x instanceof Error?x.message:"Login failed")}finally{setBusy(false)}}
 return <main className="authwrap"><form className="card auth" onSubmit={submit}><Link href="/" className="brand">BUSINESS<span>360</span></Link><h1 style={{fontFamily:"Manrope"}}>Welcome back</h1><p className="muted">Login to your business workspace.</p><label>Email</label><input className="field" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><label>Password</label><input className="field" type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/>{msg&&<div className="notice error">{msg}</div>}<button className="btn" style={{width:"100%"}} disabled={busy}>{busy?"Please wait...":"Login"}</button><p className="muted">New here? <Link href="/signup">Create a free account</Link></p></form></main>
}
