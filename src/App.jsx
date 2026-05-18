import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    obtenerRegistros()
  }, [])

  async function obtenerRegistros() {
    setCargando(true)
    const { data, error } = await supabase
      .from('asistencia_registros')
      .select('*')
      .order('hora_entrada', { ascending: false })

    if (error) {
      console.error('Error al cargar datos:', error)
    } else {
      setRegistros(data)
    }
    setCargando(false)
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Panel de Control - Asistencia 🏢</h1>
      <button 
        onClick={obtenerRegistros} 
        style={{ padding: '10px', marginBottom: '20px', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}
      >
        Actualizar Datos
      </button>

      {cargando ? (
        <p>Cargando registros en tiempo real...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>Empleado ID</th>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>Fecha</th>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>Hora Entrada</th>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>Tipo Red</th>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>Ubicación</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((registro) => (
              <tr key={registro.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{registro.empleado_id}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{registro.fecha}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {new Date(registro.hora_entrada).toLocaleTimeString()}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{registro.tipo_red || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${registro.latitud},${registro.longitud}`} 
                    target="_blank" 
                    rel="noreferrer"
                  >
                    Ver en Mapa
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default App