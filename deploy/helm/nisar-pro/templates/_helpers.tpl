{{- define "nisar.name" -}}{{ .Chart.Name }}{{- end }}
{{- define "nisar.fullname" -}}
{{- if contains .Chart.Name .Release.Name }}{{ .Release.Name | trunc 63 | trimSuffix "-" }}{{ else }}{{ printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}{{ end }}
{{- end }}
{{- define "nisar.labels" -}}
app.kubernetes.io/name: {{ include "nisar.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end }}
{{- define "nisar.selector" -}}
app.kubernetes.io/name: {{ include "nisar.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
{{- define "nisar.secretName" -}}
{{- if .Values.earthdata.existingSecret }}{{ .Values.earthdata.existingSecret }}{{ else }}{{ include "nisar.fullname" . }}-earthdata{{ end }}
{{- end }}
