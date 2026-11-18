use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// El archivo que llegó en los argumentos del proceso (T25), hasta que la
/// ventana lo pide. Se entrega una sola vez: si la página se recarga (F5 en
/// `tauri dev`), no se vuelve a abrir.
struct ArchivoInicial(Mutex<Option<String>>);

/// Elige el archivo a abrir entre los argumentos del proceso, sin el del
/// ejecutable (T25). Toma el primero cuyo nombre termine en `.brn` o
/// `.brn.json`, sin mirar mayúsculas; los demás argumentos se ignoran. Una ruta
/// relativa se completa con `base` (la carpeta actual del proceso). Con la
/// asociación de Windows llega la ruta completa, entre comillas (`"%1"`).
fn elegir_archivo<I: IntoIterator<Item = OsString>>(args: I, base: &Path) -> Option<PathBuf> {
    args.into_iter().map(PathBuf::from).find(|p| es_circuito(p)).map(|p| base.join(p))
}

/// El nombre termina en `.brn` o `.brn.json`, sin mirar mayúsculas. Un nombre
/// que no es Unicode se compara con los caracteres raros reemplazados: la
/// extensión se sigue leyendo bien.
fn es_circuito(p: &Path) -> bool {
    let Some(nombre) = p.file_name() else { return false };
    let nombre = nombre.to_string_lossy().to_lowercase();
    nombre.ends_with(".brn") || nombre.ends_with(".brn.json")
}

/// La ruta del archivo con que se abrió Bornera (doble clic en un `.brn`), o
/// nada. Solo la primera vez que se pide.
#[tauri::command]
fn archivo_inicial(estado: tauri::State<'_, ArchivoInicial>) -> Option<String> {
    estado.0.lock().ok()?.take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // `args_os` y no `args`: `args` hace panic con un argumento que no es Unicode.
    let base = std::env::current_dir().unwrap_or_default();
    // Una ruta que no se puede pasar a texto no llega a la página: no se abre.
    let inicial = elegir_archivo(std::env::args_os().skip(1), &base)
        .and_then(|p| p.into_os_string().into_string().ok());
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // T15a: diálogos nativos de abrir y guardar, y lectura y escritura de
        // los .brn. El diálogo habilita en el alcance de fs la ruta elegida.
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(ArchivoInicial(Mutex::new(inicial)))
        .invoke_handler(tauri::generate_handler![archivo_inicial])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn os(v: &[&str]) -> Vec<OsString> {
        v.iter().map(OsString::from).collect()
    }

    fn base() -> PathBuf {
        if cfg!(windows) {
            PathBuf::from(r"C:\Usuarios\Bruno Jerke\circuitos")
        } else {
            PathBuf::from("/home/bruno/circuitos")
        }
    }

    #[test]
    fn sin_argumentos_no_hay_archivo() {
        assert_eq!(elegir_archivo(os(&[]), &base()), None);
    }

    #[test]
    fn ruta_completa_queda_igual() {
        let ruta = if cfg!(windows) { r"D:\Tableros\Marcha parada.brn" } else { "/tmp/Marcha parada.brn" };
        assert_eq!(elegir_archivo(os(&[ruta]), &base()), Some(PathBuf::from(ruta)));
    }

    #[test]
    fn mayusculas_en_la_extension() {
        assert_eq!(elegir_archivo(os(&["X.BRN"]), &base()), Some(base().join("X.BRN")));
        assert_eq!(elegir_archivo(os(&["x.Brn.JSON"]), &base()), Some(base().join("x.Brn.JSON")));
    }

    #[test]
    fn brn_json() {
        assert_eq!(elegir_archivo(os(&["tablero.brn.json"]), &base()), Some(base().join("tablero.brn.json")));
    }

    #[test]
    fn ignora_los_argumentos_que_no_son_circuitos() {
        let args = os(&["--verbose", "notas.txt", "datos.json", "x.brn.tmp", "brn", "", "motor.brn", "otro.brn"]);
        assert_eq!(elegir_archivo(args, &base()), Some(base().join("motor.brn")));
        assert_eq!(elegir_archivo(os(&["--verbose", "datos.json", "x.brn.tmp"]), &base()), None);
    }

    #[test]
    fn ruta_relativa_se_completa_con_la_carpeta_actual() {
        let rel = Path::new("sub").join("motor.brn");
        let elegido = elegir_archivo(vec![rel.clone().into_os_string()], &base()).unwrap();
        assert_eq!(elegido, base().join(&rel));
        assert!(elegido.is_absolute());
    }

    #[cfg(windows)]
    #[test]
    fn argumento_que_no_es_unicode() {
        use std::os::windows::ffi::{OsStrExt, OsStringExt};
        // "a" + un sustituto suelto + ".brn": no es Unicode válido.
        let mut ancho: Vec<u16> = vec![u16::from(b'a'), 0xD800];
        ancho.extend(std::ffi::OsStr::new(".brn").encode_wide());
        let raro = OsString::from_wide(&ancho);
        let elegido = elegir_archivo(vec![raro.clone()], &base()).unwrap();
        assert_eq!(elegido, base().join(&raro));
        // No se puede pasar a texto: `run` no lo entrega a la página.
        assert!(elegido.into_os_string().into_string().is_err());
    }

    #[cfg(unix)]
    #[test]
    fn argumento_que_no_es_unicode() {
        use std::os::unix::ffi::OsStringExt;
        let raro = OsString::from_vec(b"a\xFF.brn".to_vec());
        let elegido = elegir_archivo(vec![raro.clone()], &base()).unwrap();
        assert_eq!(elegido, base().join(&raro));
        assert!(elegido.into_os_string().into_string().is_err());
    }
}
