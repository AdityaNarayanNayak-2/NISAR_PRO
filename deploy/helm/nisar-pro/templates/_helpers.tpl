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
{{- define "nisar.queueUrl" -}}
{{- if .Values.queue.externalUrl }}{{ .Values.queue.externalUrl }}{{ else }}redis://{{ include "nisar.fullname" . }}-redis:6379{{ end }}
{{- end }}
{{- define "nisar.image" -}}
"{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
{{- end }}
{{- define "nisar.claim" -}}
{{ .Values.persistence.existingClaim | default (printf "%s-data" (include "nisar.fullname" .)) }}
{{- end }}
{{/* Shared env for gateway and workers. */}}
{{- define "nisar.env" -}}
- name: RUST_LOG
  value: {{ .Values.logLevel | quote }}
{{- if .Values.queue.enabled }}
- name: NISAR_QUEUE_URL
  value: {{ include "nisar.queueUrl" . | quote }}
{{- end }}
{{- if or .Values.earthdata.token .Values.earthdata.existingSecret }}
- name: EARTHDATA_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{ include "nisar.secretName" . }}
      key: EARTHDATA_TOKEN
{{- end }}
{{- end }}
