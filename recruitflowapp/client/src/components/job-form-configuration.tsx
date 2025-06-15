import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Settings, Eye, FileText, Phone, MapPin, CreditCard, Users } from "lucide-react";

// Form configuration schema
const jobFormConfigSchema = z.object({
  formHeaderText: z.string().optional(),
  formDescription: z.string().optional(),
  requirePhone: z.boolean().default(false),
  requireAddress: z.boolean().default(false),
  showLicenseOptions: z.boolean().default(false),
  licenseStateName: z.string().optional(),
  enableResumeUpload: z.boolean().default(true),
  requireResume: z.boolean().default(false),
});

type JobFormConfigData = z.infer<typeof jobFormConfigSchema>;

interface JobFormConfigurationProps {
  initialData?: Partial<JobFormConfigData>;
  onSave: (data: JobFormConfigData) => void;
  isLoading?: boolean;
}

export function JobFormConfiguration({ initialData, onSave, isLoading }: JobFormConfigurationProps) {
  const [previewMode, setPreviewMode] = useState(false);

  const form = useForm<JobFormConfigData>({
    resolver: zodResolver(jobFormConfigSchema),
    defaultValues: {
      formHeaderText: initialData?.formHeaderText || "",
      formDescription: initialData?.formDescription || "",
      requirePhone: initialData?.requirePhone || false,
      requireAddress: initialData?.requireAddress || false,
      showLicenseOptions: initialData?.showLicenseOptions || false,
      licenseStateName: initialData?.licenseStateName || "",
      enableResumeUpload: initialData?.enableResumeUpload !== false,
      requireResume: initialData?.requireResume || false,
    },
  });

  const watchedValues = form.watch();

  const onSubmit = (data: JobFormConfigData) => {
    onSave(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Application Form Configuration</h3>
          <p className="text-sm text-gray-500">
            Customize how candidates apply to this position
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreviewMode(!previewMode)}
        >
          <Eye className="w-4 h-4 mr-2" />
          {previewMode ? "Edit" : "Preview"}
        </Button>
      </div>

      {previewMode ? (
        <FormPreview config={watchedValues} />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Header Customization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Form Content
                </CardTitle>
                <CardDescription>
                  Customize the header and description text for your application form
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="formHeaderText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form Header</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Real Estate Agent - Application"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The main title displayed at the top of the application form
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="formDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Please fill out the application as accurately as possible. After submitting we will review your application and get back to you as soon as possible."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Introductory text that appears below the header
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Field Requirements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Field Requirements
                </CardTitle>
                <CardDescription>
                  Configure which fields are required or optional
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="requirePhone"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center">
                          <Phone className="w-4 h-4 mr-2" />
                          Phone Number
                        </FormLabel>
                        <FormDescription>
                          Make phone number a required field
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requireAddress"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center">
                          <MapPin className="w-4 h-4 mr-2" />
                          Address
                        </FormLabel>
                        <FormDescription>
                          Make address a required field
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Resume Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Resume Upload
                </CardTitle>
                <CardDescription>
                  Configure resume/CV upload requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="enableResumeUpload"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Enable Resume Upload</FormLabel>
                        <FormDescription>
                          Allow candidates to upload their resume/CV
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {watchedValues.enableResumeUpload && (
                  <FormField
                    control={form.control}
                    name="requireResume"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Require Resume</FormLabel>
                          <FormDescription>
                            Make resume upload mandatory for application submission
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* License Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  License Options
                </CardTitle>
                <CardDescription>
                  Configure real estate license-related questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="showLicenseOptions"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Show License Questions</FormLabel>
                        <FormDescription>
                          Display license status checkboxes for real estate positions
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {watchedValues.showLicenseOptions && (
                  <FormField
                    control={form.control}
                    name="licenseStateName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., California, Texas, Florida"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The state name to display in license questions
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}

// Preview component to show how the form will look
function FormPreview({ config }: { config: JobFormConfigData }) {
  const headerText = config.formHeaderText || "Real Estate Agent - Application";
  const descriptionText = config.formDescription || "Please fill out the application as accurately as possible. After submitting we will review your application and get back to you as soon as possible.";
  const stateName = config.licenseStateName || "STATE_NAME";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Form Preview</CardTitle>
        <CardDescription>
          This is how your application form will appear to candidates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-2xl mx-auto bg-white border rounded-lg p-8">
          {/* Company Logo Placeholder */}
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-32 bg-black text-white flex items-center justify-center rounded text-sm">
              Company Logo
            </div>
            <p className="text-gray-500 mt-2 text-sm">REALTORS</p>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{headerText}</h1>
            <p className="mt-4 text-md text-gray-600 max-w-2xl mx-auto">
              {descriptionText}
            </p>
          </div>

          {/* Form Fields Preview */}
          <div className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  First Name <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 h-10 bg-gray-100 border rounded-md"></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 h-10 bg-gray-100 border rounded-md"></div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 h-10 bg-gray-100 border rounded-md"></div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Phone Number {config.requirePhone && <span className="text-red-500">*</span>}
              </label>
              <div className="mt-1 h-10 bg-gray-100 border rounded-md"></div>
            </div>

            {/* Address */}
            {config.requireAddress && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Address <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 h-10 bg-gray-100 border rounded-md"></div>
              </div>
            )}

            {/* Resume Upload */}
            {config.enableResumeUpload && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  CV/Resume {config.requireResume && <span className="text-red-500">*</span>}
                </label>
                <div className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">File upload area</p>
                </div>
              </div>
            )}

            {/* License Options */}
            {config.showLicenseOptions && (
              <fieldset className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-4 h-4 border border-gray-300 rounded mt-0.5"></div>
                  <label className="text-sm font-medium text-gray-700">
                    I am NOT currently a licensed real estate agent in {stateName}, but would like assistance becoming one
                  </label>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-4 h-4 border border-gray-300 rounded mt-0.5"></div>
                  <label className="text-sm font-medium text-gray-700">
                    I AM currently a licensed real estate agent in {stateName}
                  </label>
                </div>
              </fieldset>
            )}

            {/* Marketing Consent */}
            <div className="flex items-start space-x-3">
              <div className="w-4 h-4 border border-gray-300 rounded mt-0.5"></div>
              <label className="text-sm text-gray-600">
                I agree to receive marketing messaging...
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <div className="w-full h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-medium">Submit Application</span>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Summary */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-3">Configuration Summary</h4>
          <div className="flex flex-wrap gap-2">
            {config.requirePhone && <Badge variant="secondary">Phone Required</Badge>}
            {config.requireAddress && <Badge variant="secondary">Address Required</Badge>}
            {config.enableResumeUpload && <Badge variant="secondary">Resume Upload</Badge>}
            {config.requireResume && <Badge variant="secondary">Resume Required</Badge>}
            {config.showLicenseOptions && <Badge variant="secondary">License Questions</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}