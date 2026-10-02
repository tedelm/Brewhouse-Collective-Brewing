package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"brewhouse/internal/service"
)

// Me handles GET/PATCH /api/me for the authenticated user.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	actor, ok := h.actor(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
		return
	}

	switch r.Method {
	case http.MethodGet:
		user, err := h.users.Get(actor.UserID)
		if err != nil {
			h.writeErr(w, err)
			return
		}
		canView, err := h.access.CanViewEconomy(actor)
		if err != nil {
			h.writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, MeResponse{User: *user, CanViewEconomy: canView})
	case http.MethodPatch, http.MethodPut:
		var req UpdateProfileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "invalid body"})
			return
		}
		user, err := h.users.UpdateProfile(actor.UserID, req.Email, req.Password, service.UserContact{
			FirstName:    req.FirstName,
			LastName:     req.LastName,
			AddressLine1: req.AddressLine1,
			AddressLine2: req.AddressLine2,
			Phone:        req.Phone,
			Instagram:    req.Instagram,
			Untappd:      req.Untappd,
		})
		if err != nil {
			writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, user)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{Error: "method not allowed"})
	}
}

// AppTour handles /api/me/app-tour and /api/me/app-tour/{complete,reset}.
func (h *Handler) AppTour(w http.ResponseWriter, r *http.Request) {
	actor, ok := h.actor(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
		return
	}

	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/me/app-tour"), "/")
	switch rest {
	case "":
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{Error: "method not allowed"})
			return
		}
		status, err := h.settings.GetAppTourStatus(actor)
		if err != nil {
			h.writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, status)
	case "complete":
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{Error: "method not allowed"})
			return
		}
		status, err := h.settings.CompleteAppTour(actor)
		if err != nil {
			h.writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, status)
	case "reset":
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{Error: "method not allowed"})
			return
		}
		status, err := h.settings.ResetAppTour(actor)
		if err != nil {
			h.writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, status)
	default:
		writeJSON(w, http.StatusNotFound, ErrorResponse{Error: "not found"})
	}
}
