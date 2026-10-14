import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Briefcase, KeyRound, Loader2, ArrowRight, ShieldCheck, Smartphone } from 'lucide-react'
import { api } from '../../api'
import '../../projects-tailwind.css'

export default function PublicProjectLogin() {
  const { slug } = useParams()
  const navigate = useNavigate()
  
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState(1) // 1: Phone, 2: Code
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendCode = async (e) => {
    e.preventDefault()
    if (!phone) return
    
    setLoading(true)
    setError('')
    try {
      // Clean phone number
      const cleanPhone = phone.replace(/\D/g, '')
      await api.post(`/projects/public/${slug}/otp/send`, { phone_number: cleanPhone })
      setStep(2)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Erro ao enviar código. Verifique se seu número está cadastrado no projeto.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    if (!code) return

    setLoading(true)
    setError('')
    try {
      const cleanPhone = phone.replace(/\D/g, '')
      const res = await api.post(`/projects/public/${slug}/otp/verify`, { 
        phone_number: cleanPhone,
        code: code
      })
      
      // Store the session token
      localStorage.setItem(`project_token_${slug}`, res.token)
      
      // Navigate to dashboard
      navigate(`/p/${slug}/dashboard`)
    } catch (err) {
      console.error(err)
      setError('Código inválido ou expirado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-xl">
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-500/20 p-4 rounded-2xl border border-indigo-500/30">
            <Briefcase className="w-10 h-10 text-indigo-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-white mb-2">
          Acesso ao Projeto
        </h1>
        <p className="text-slate-400 text-center text-sm mb-8">
          Identifique-se para acessar o painel de gerenciamento e acompanhar o andamento.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm font-medium text-center">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Seu número de WhatsApp
              </label>
              <input
                type="text"
                placeholder="Ex: 5511999999999"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
              />
              <p className="text-xs text-slate-500 mt-2">
                Enviaremos um código de 6 dígitos para confirmar sua identidade.
              </p>
            </div>
            
            <button
              disabled={loading || !phone}
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl py-3 font-semibold transition-all flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>Receber Código <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Código de Acesso
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-mono"
              />
            </div>
            
            <button
              disabled={loading || code.length !== 6}
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl py-3 font-semibold transition-all flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>Confirmar e Acessar <ShieldCheck className="w-4 h-4" /></>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-center text-sm text-slate-400 hover:text-white mt-4 transition-colors"
            >
              Voltar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
