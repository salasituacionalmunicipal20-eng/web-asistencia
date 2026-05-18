import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Save, FileText } from 'lucide-react'

export default function Memos() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [lista, setLista] = useState([])
  const [formulario, setFormulario] = useState({ empleado_id: '', titulo: '', descripcion: '' })
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })

  useEffect(() => {
    obtenerMemos()
    const verificarPantalla = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', verificarPantalla)
    return () => window.removeEventListener('resize', verificarPantalla)
  }, [])

  async function obtenerMemos() {
    const { data } = await supabase.from('memorandums').select('*').order('fecha_emision', { ascending: false })
    if (data) setLista(data)
  }

  const manejarCambio = (e) => setFormulario({ ...formulario, [e.target.name]: e.target.value })

  const enviarMemo = async (e) => {
    e.preventDefault()
    setMensaje({ texto: 'Enviando memorándum...', tipo: 'info' })
    const { error } = await supabase.from('memorandums').insert([formulario])
    
    if (error) {
      setMensaje({ texto: '⛔ Hubo un error al enviar el memorándum.', tipo: 'error' })
    } else {
      setMensaje({ texto: `✅ Memorándum enviado a la Cédula: ${formulario.empleado_id}`, tipo: 'exito' })
      setFormulario({ empleado_id: '', titulo: '', descripcion: '' })
      obtenerMemos()
    }
  }

  const estiloInput = { width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #475569', fontSize: '15px', outline: 'none' }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '5px' : '0' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 5px 0', color: '#0f172a', fontSize: isMobile ? '24px' : '28px', fontWeight: '800' }}>Emisión de Memorándums</h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>Redacta llamados de atención y comunicados directos a la App del empleado.</p>
      </div>

      <div style={{ backgroundColor: 'white', padding: isMobile ? '20px' : '35px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '40px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 20px 0', color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', textTransform: 'uppercase' }}>
          <FileText size={22} /> Redactar Nuevo Documento
        </h3>
        
        <form onSubmit={enviarMemo} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>Cédula Destino</label>
              <input type="text" name="empleado_id" value={formulario.empleado_id} onChange={manejarCambio} required placeholder="Ej: V18601325" style={{ ...estiloInput, border: '2px solid #bae6fd', backgroundColor: '#f0f9ff', fontWeight: 'bold' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>Título / Asunto</label>
              <input type="text" name="titulo" value={formulario.titulo} onChange={manejarCambio} required placeholder="Ej: Llamado de atención por retardo" style={estiloInput} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>Cuerpo del Mensaje</label>
            <textarea name="descripcion" value={formulario.descripcion} onChange={manejarCambio} required rows="4" placeholder="Redacte aquí el motivo institucional..." style={{ ...estiloInput, resize: 'vertical' }}></textarea>
          </div>

          <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '15px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            <Save size={20}/> Emitir Memorándum a la App
          </button>
        </form>
        {mensaje.texto && <div style={{ marginTop: '20px', padding: '15px', borderRadius: '8px', backgroundColor: mensaje.tipo === 'error' ? '#fee2e2' : '#d1fae5', color: mensaje.tipo === 'error' ? '#ef4444' : '#059669', fontWeight: '600', textAlign: 'center', fontSize: '14px' }}>{mensaje.texto}</div>}
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}><h3 style={{ margin: 0, color: '#0f172a', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase' }}>Historial de Memos Enviados</h3></div>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Fecha</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Destinatario</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Asunto</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>Lectura App</th>
              </tr>
            </thead>
            <tbody>
              {lista?.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px' }}>
                  <td style={{ padding: '15px 20px', fontWeight: '600', color: '#475569' }}>{String(item?.fecha_emision || '').substring(0,10)}</td>
                  <td style={{ padding: '15px 20px', fontWeight: '700', color: '#0f172a' }}>{item?.empleado_id}</td>
                  <td style={{ padding: '15px 20px', color: '#1e293b', fontWeight: '500' }}>{item?.titulo}</td>
                  <td style={{ padding: '15px 20px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', backgroundColor: item?.leido ? '#dcfce7' : '#f1f5f9', color: item?.leido ? '#16a34a' : '#64748b' }}>
                      {item?.leido ? 'Visto por Empleado' : 'No Visto'}
                    </span>
                  </td>
                </tr>
              ))}
              {(!lista || lista.length === 0) && (
                <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No se han emitido memorándums.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}