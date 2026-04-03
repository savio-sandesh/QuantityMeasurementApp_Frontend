# Quantity Measurement App Frontend

Angular 18 migration of the quantity measurement UI. The frontend now uses standalone components, reactive forms, Angular Material, and signals with a modern 2026 dashboard redesign implemented in component-scoped SCSS.

## What Changed

- Service-oriented measurement flow moved into `MeasurementService`
- Standalone auth and converter components
- Reactive forms with validation, including non-negative measurement values
- Angular Material controls, cards, buttons, form fields, and selects
- Signals for measurement result, history, count, and load state
- Lucide Angular icons for dashboard and auth visual system
- Modernized maroon + elevated neutral visual theme via global style tokens
- Converter dashboard with clean side category panel and soft neutral surfaces
- Refined clean card-based auth and dashboard UI inspired by modern admin layouts
- Smoother animated transitions for auth tab/forms, cards, and action controls
- Real-time conversion behavior in convert mode (auto-run using form value changes)
- Sticky-header history table inside dashboard card layout
- Split-screen auth layout with smooth login/signup panel transitions
- Original CSS translated into scoped SCSS per component

## Project Structure

```text
.
|-- angular.json
|-- index.html
|-- package.json
|-- src
|   |-- main.ts
|   |-- styles.scss
|   `-- app
|       |-- app.routes.ts
|       |-- app.config.ts
|       |-- core
|       |   |-- constants
|       |   |   `-- api.constants.ts
|       |   |-- guards
|       |   |   |-- auth.guard.ts
|       |   |   `-- guest.guard.ts
|       |   |-- interceptors
|       |   |   `-- auth.interceptor.ts
|       |   |-- models
|       |   |   `-- measurement.models.ts
|       |   `-- services
|       |       |-- auth.service.ts
|       |       `-- measurement.service.ts
|       |-- layout
|       |   `-- shell
|       |       |-- app.component.ts
|       |       |-- app.component.html
|       |       `-- app.component.scss
|       `-- features
|           |-- auth
|           |   |-- auth.component.ts
|           |   |-- auth.component.html
|           |   `-- auth.component.scss
|           `-- converter
|               |-- converter.component.ts
|               |-- converter.component.html
|               `-- converter.component.scss
```

## Run It

1. Start backend API first from `c:\QuantityMeasurementApp`:
	`dotnet run --project .\src\QuantityMeasurementWebApi\QuantityMeasurementWebApi.csproj`
2. Install frontend dependencies with `npm install`.
3. Start the Angular app with `npm start`.
4. Frontend API calls use a dev proxy (`proxy.conf.json`) to route `/api/*` to `http://localhost:5111`.

## Backend Endpoints

Auth:

- `POST http://localhost:5111/api/v1/auth/register`
- `POST http://localhost:5111/api/v1/auth/login`

Quantity:

- `POST http://localhost:5111/api/v1/quantities/convert`
- `POST http://localhost:5111/api/v1/quantities/compare`
- `POST http://localhost:5111/api/v1/quantities/add`
- `POST http://localhost:5111/api/v1/quantities/subtract`
- `POST http://localhost:5111/api/v1/quantities/divide`
- `GET http://localhost:5111/api/v1/quantities/history`
- `GET http://localhost:5111/api/v1/quantities/count`

## Notes

- Legacy HTML/CSS/JS frontend files were removed to keep the codebase Angular-only.
- Token storage still uses the existing `jwtToken` key for compatibility.
- Tailwind CSS tooling is installed for future utility-driven styling expansion; current UI styling is SCSS-first.
